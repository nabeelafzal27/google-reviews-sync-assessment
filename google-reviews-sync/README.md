# Google Reviews Sync Service

Integration service that receives restaurant feedback events and attempts to sync positive reviews to Google Reviews, with full status tracking, idempotency, retry logic, and fallback handling.

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run the service
npm start

# The service starts on http://localhost:3000
# API docs: http://localhost:3000/api-docs
# Health check: http://localhost:3000/health
```

## Development

```bash
# Run in development mode (ts-node, no build required)
npm run dev

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage report
npm run test:coverage
```

## API Endpoints

| Method | Path                                              | Description                               |
| ------ | ------------------------------------------------- | ----------------------------------------- |
| POST   | `/integrations/google-reviews/sync`               | Trigger sync attempt for a feedback event |
| GET    | `/integrations/google-reviews/status/:feedbackId` | Get sync status for a feedback event      |
| POST   | `/integrations/google-reviews/retry/:feedbackId`  | Manually retry a failed sync attempt      |
| GET    | `/api-docs`                                       | Swagger UI documentation                  |
| GET    | `/health`                                         | Health check                              |

## Demo Scenarios

### 1. Success Scenario

```bash
curl -s -X POST http://localhost:3000/integrations/google-reviews/sync \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "fb_001",
    "restaurantId": "resto_123",
    "rating": 5,
    "isFeedbackNegative": false,
    "timestamp": "2026-03-25T12:00:00.000Z",
    "restoinfo": {
      "googleSyncEnabled": true,
      "googleReviewUrl": "https://g.page/r/restaurant-a/review"
    },
    "simulateMode": "FORCE_SYNCED"
  }' | jq .
```

Expected: `status: "SYNCED"`, `reasonCode: "ELIGIBLE_AND_SYNCED"`

### 2. Provider-Limited Scenario (Policy Block + Fallback)

```bash
curl -s -X POST http://localhost:3000/integrations/google-reviews/sync \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "fb_002",
    "restaurantId": "resto_123",
    "rating": 5,
    "isFeedbackNegative": false,
    "timestamp": "2026-03-25T12:05:00.000Z",
    "restoinfo": {
      "googleSyncEnabled": true,
      "googleReviewUrl": "https://g.page/r/restaurant-a/review"
    },
    "simulateMode": "FORCE_POLICY_BLOCK"
  }' | jq .
```

Expected: `status: "BLOCKED_BY_PROVIDER_POLICY"`, `fallback.promptIssued: true`, `fallback.promptUrl` present

### 3. Duplicate Event Scenario

```bash
# First event
curl -s -X POST http://localhost:3000/integrations/google-reviews/sync \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "fb_006",
    "restaurantId": "resto_123",
    "rating": 5,
    "isFeedbackNegative": false,
    "timestamp": "2026-03-25T12:25:00.000Z",
    "restoinfo": { "googleSyncEnabled": true },
    "simulateMode": "FORCE_SYNCED"
  }' | jq .

# Duplicate event (same feedbackId) - returns existing status, no duplicate side effects
curl -s -X POST http://localhost:3000/integrations/google-reviews/sync \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "fb_006",
    "restaurantId": "resto_123",
    "rating": 5,
    "isFeedbackNegative": false,
    "timestamp": "2026-03-25T12:26:00.000Z",
    "restoinfo": { "googleSyncEnabled": true },
    "simulateMode": "FORCE_SYNCED"
  }' | jq .
```

Expected: Both return `status: "SYNCED"`, `attemptCount: 1` (no duplicate provider call)

### 4. Retry Scenario

```bash
# Create a retryable failure (timeout)
curl -s -X POST http://localhost:3000/integrations/google-reviews/sync \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "fb_005",
    "restaurantId": "resto_123",
    "rating": 5,
    "isFeedbackNegative": false,
    "timestamp": "2026-03-25T12:20:00.000Z",
    "restoinfo": {
      "googleSyncEnabled": true,
      "googleReviewUrl": "https://g.page/r/restaurant-a/review"
    },
    "simulateMode": "FORCE_TIMEOUT"
  }' | jq .

# Check status
curl -s http://localhost:3000/integrations/google-reviews/status/fb_005 | jq .

# Trigger manual retry
curl -s -X POST http://localhost:3000/integrations/google-reviews/retry/fb_005 \
  -H "Content-Type: application/json" \
  -d '{ "requestedBy": "admin" }' | jq .
```

Expected: First call returns `FAILED_RETRYABLE`, retry returns `retryAccepted: true`

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture notes covering:

- System boundaries and layered architecture
- Idempotency strategy
- Retry policy with exponential backoff
- Fallback review-prompt path
- Status taxonomy and eligibility rules

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** SQLite (better-sqlite3) - zero-setup, file-based
- **Validation:** Ajv (JSON Schema)
- **Testing:** Jest + supertest
- **API Docs:** Swagger UI (swagger-jsdoc + swagger-ui-express)

## Project Structure

```
src/
├── index.ts              # Server entry point with startup validation
├── app.ts                # Express app factory (testable)
├── config.ts             # Business rule constants + config validation
├── types.ts              # TypeScript enums, interfaces & error taxonomy
├── logger.ts             # Structured JSON logger with child loggers
├── db/                   # Database connection & migrations
├── repositories/         # Data access layer
├── services/             # Business logic (eligibility, orchestrator, retry)
├── providers/            # External API adapters (Google Reviews)
├── controllers/          # Request/response handlers
├── routes/               # Route definitions with Swagger docs
└── middleware/            # Validation, error handling & request correlation
```

## Assumptions

1. **No real Google API exists for creating reviews.** The `simulateMode` field drives provider behavior for testing. In production, the provider adapter would make real HTTP calls to the Google Business Profile API (or acknowledge the limitation and always fall back).

2. **Feedback events arrive pre-processed.** The sync endpoint receives already-normalized events with a `feedbackId`. The upstream `SendFeedBack` endpoint (from contracts.json) is part of the existing system and not built here.

3. **SQLite is sufficient for assessment scope.** For a production deployment with concurrent writes, PostgreSQL would be more appropriate.

4. **Retries are manual via the retry endpoint.** A production system would use a background worker with scheduled retry execution.

5. **The `restoinfo` object is optional** but `googleSyncEnabled` defaults to eligible if not explicitly set to `false` (fail-open for the sync flag).

## Trade-offs

| Decision                       | Trade-off                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| SQLite over PostgreSQL         | Zero setup for evaluators, but single-writer limitation                 |
| Synchronous retries            | Simpler implementation, but no automatic background retry               |
| In-process validation (Ajv)    | Fast and lightweight, but no external schema registry                   |
| Singleton DB connection        | Simple for assessment, but not suitable for connection pooling at scale |
| `simulateMode` in request body | Enables deterministic testing, but wouldn't exist in production         |

## What I Would Improve With One Extra Week

1. **Background retry worker** - Scheduled job that polls for `FAILED_RETRYABLE` records and automatically retries with proper delay enforcement
2. **PostgreSQL migration** - Replace SQLite with Postgres for production-grade concurrent access
3. **Rate limiting** - Express rate limiter on all endpoints to prevent abuse
4. **Metrics endpoint** - Prometheus-compatible metrics (sync success rate, attempt counts, latency)
5. **Audit trail** - Separate `sync_attempts` table tracking each individual attempt with full request/response
6. **Circuit breaker** - On the provider adapter to stop calling Google when it's consistently failing
7. **API authentication** - JWT or API key validation on all endpoints
8. **Containerization** - Dockerfile + docker-compose for consistent deployment
9. **Log aggregation** - Ship structured logs to Cloudwatch/Datadog for centralized monitoring
