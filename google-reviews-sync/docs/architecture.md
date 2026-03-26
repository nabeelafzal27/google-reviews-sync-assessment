# Architecture Notes

## System Overview

This service acts as an integration layer between an internal feedback system and Google Reviews. It receives feedback events, evaluates whether they qualify for Google sync, attempts the sync via a provider adapter and records the outcome with full status tracking.

```
                    ┌─────────────────────────────────────────────┐
                    │           Google Reviews Sync Service       │
                    │                                             │
  Feedback Event ──>│  Routes ─> Controller ─> Orchestrator       │
  (POST /sync)      │                            │                │
                    │                    ┌───────┴───────┐        │
                    │                    │               │        │
                    │              Eligibility      Provider      │
                    │              Service         Adapter        │
                    │                    │               │        │
                    │                    └───────┬───────┘        │
                    │                            │                │
                    │                       Repository            │
                    │                            │                │
                    │                        SQLite DB            │
                    └─────────────────────────────────────────────┘
```

## Layered Architecture

The service uses a strict layered architecture where each layer depends only on the layer below it:

| Layer          | Files                                    | Responsibility                                |
| -------------- | ---------------------------------------- | --------------------------------------------- |
| **HTTP**       | `routes/`, `controllers/`, `middleware/` | Request parsing, validation, response shaping |
| **Service**    | `services/`                              | Business logic, orchestration, eligibility    |
| **Provider**   | `providers/`                             | External API adapter (Google Reviews)         |
| **Repository** | `repositories/`                          | Database persistence                          |
| **Database**   | `db/`                                    | Connection management, migrations             |

This separation ensures testability (each layer can be tested independently) and maintainability (changing the provider or database doesn't affect business logic).

## Boundaries

### Input Boundary

- JSON Schema validation via Ajv at the HTTP layer
- Required fields enforced: `feedbackId`, `restaurantId`, `rating`, `isFeedbackNegative`, `timestamp`
- Invalid requests rejected with 400 before reaching business logic

### Provider Boundary

- The `google-reviews.provider.ts` adapter abstracts the external Google API
- Uses `simulateMode` for deterministic testing (in production, this would make real HTTP calls)
- The orchestrator depends on the `ProviderResult` interface, not the implementation

### Persistence Boundary

- Repository pattern encapsulates all SQL operations
- JSON columns (`lastError`, `fallback`) serialized/deserialized at the repository layer
- Business logic works with typed interfaces, never raw SQL

## Idempotency

Idempotency is enforced at two levels:

1. **Database constraint**: `feedback_id` is the PRIMARY KEY; `idempotency_key` has a UNIQUE constraint. Duplicate inserts fail at the DB level as a safety net.

2. **Orchestrator logic**: Before any processing, the orchestrator checks for an existing record:
   - If the record has a **terminal status** (SYNCED, BLOCKED, PERMANENT, SKIPPED), the existing status is returned and `duplicate_count` is incremented. No provider call is made.
   - If the record has **FAILED_RETRYABLE** status, re-processing is allowed (enabling the retry flow).

The idempotency key follows the template: `google_reviews:{feedbackId}`

This ensures that even if the same feedback event is received multiple times (e.g., due to message queue at-least-once delivery), the provider is called at most once for successful/terminal outcomes.

## Retry Policy

Retries use **bounded exponential backoff**:

| Parameter          | Value    |
| ------------------ | -------- |
| Max attempts       | 3        |
| Initial delay      | 2,000ms  |
| Backoff multiplier | 2x       |
| Max delay cap      | 30,000ms |

Delay progression: 2s → 4s → 8s (capped at 30s for higher attempts).

### How Retries Work

1. A failed sync with a retryable error (timeout, rate limit) is stored as `FAILED_RETRYABLE`
2. The `POST /retry/:feedbackId` endpoint checks:
   - Record exists and is `FAILED_RETRYABLE`
   - `attemptCount` is below `maxAttempts` (3)
3. If allowed, the provider is called again and the record is updated
4. On success → status becomes `SYNCED`; on failure → stays `FAILED_RETRYABLE` or becomes `FAILED_PERMANENT`

### Current Limitation & Production Enhancement

In this implementation, retries are triggered manually via the retry endpoint. In a production system, I would add:

- A background worker that polls for `FAILED_RETRYABLE` records
- Actual delay enforcement (sleep/scheduled job) between attempts
- Dead-letter handling after max attempts exhausted

## Fallback Strategy

Google does not provide a public API for programmatically creating reviews. When the provider returns `CREATE_REVIEW_NOT_SUPPORTED` (which would be the most common real-world outcome):

1. Status is set to `BLOCKED_BY_PROVIDER_POLICY`
2. A **fallback object** is generated:
   - `promptUrl`: The restaurant's Google Review URL (from `restoinfo.googleReviewUrl`)
   - `promptIssued`: `true` if a URL is available, `false` otherwise
   - `promptIssuedAt`: Timestamp of when the fallback was created

This fallback URL can be used by the calling system to redirect the customer to Google's review page, where they can leave the review manually. The status record documents exactly why direct sync wasn't possible and what fallback action was taken.

## Status Taxonomy

| Status                       | Meaning                                   | Terminal? | Retryable? |
| ---------------------------- | ----------------------------------------- | --------- | ---------- |
| `SYNCED`                     | Successfully synced to Google             | Yes       | No         |
| `BLOCKED_BY_PROVIDER_POLICY` | Google API doesn't support this operation | Yes       | No         |
| `FAILED_RETRYABLE`           | Temporary failure (timeout, rate limit)   | No        | Yes        |
| `FAILED_PERMANENT`           | Permanent failure (bad request, auth)     | Yes       | No         |
| `SKIPPED_NOT_ELIGIBLE`       | Feedback didn't meet sync criteria        | Yes       | No         |

## Eligibility Rules

Checked in priority order (first failing check determines the reason code):

1. **Negative feedback** → `NOT_ELIGIBLE_NEGATIVE_FEEDBACK`
2. **Rating < 4** → `NOT_ELIGIBLE_LOW_RATING`
3. **Restaurant Google sync disabled** → `NOT_ELIGIBLE_GOOGLE_DISABLED`

This ordering ensures that if a feedback event is both negative AND low-rated, the more specific reason (negative) is reported.

## Cross-Cutting Concerns

### Structured Logging

All log output is JSON-formatted via a lightweight custom logger (`src/logger.ts`). Each entry includes timestamp, level, message, and contextual fields. The logger supports child instances with pre-bound context (e.g., requestId), making it easy to trace a request through the system.

Logs are silenced in test environments (`NODE_ENV=test`) to keep test output clean.

### Request Correlation

Every incoming request is assigned a unique correlation ID via the `request-context` middleware. If the caller sends an `X-Request-ID` header, that value is used; otherwise a UUID is generated. This ID is:
- Passed to the logger for all downstream log entries
- Included in error responses for debugging

### Error Taxonomy

Errors use a typed hierarchy (`AppError` → `NotFoundError`, `ValidationError`, `ProviderError`) instead of generic throws. Each error carries its own HTTP status code and optional structured context. The global error handler maps these to appropriate JSON responses, only logging 5xx errors (expected 4xx errors like 404s are silent).

### Interface-Based Dependency Injection

The provider layer is defined as an interface (`GoogleReviewsProvider`) in `types.ts`. The orchestrator depends on this interface, not the concrete `SimulatedGoogleReviewsProvider`. This means swapping in a real Google API client requires no changes to business logic — just a different implementation injected at construction time.

### Startup Validation

The service validates all configuration values before accepting traffic (`validateConfig()` in `config.ts`). Invalid port numbers, negative retry delays, or missing database paths cause an immediate exit with a clear error message. This fail-fast approach prevents silent misconfigurations in production.

### Immutability

All TypeScript interfaces use `readonly` fields. The config object is frozen with `Object.freeze()`. Provider results use discriminated unions (`ProviderSuccess | ProviderFailure`) that the compiler enforces — you cannot access `error` on a success result without narrowing first.

## Data Model

Single table `sync_status` with `feedback_id` as primary key. JSON columns for nested objects (`last_error`, `fallback`). All timestamps stored as ISO 8601 strings. This keeps the schema simple while preserving all the information needed for status reporting and debugging.
