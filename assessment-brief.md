# Candidate Assessment Brief
## Senior Integrations Engineer - Google Reviews Sync Attempt

**Timebox:** 2 days  
**Access:** No internal codebase access  
**Submission type:** Standalone repository

---

## Goal

Build a small service that receives feedback events and attempts to sync to Google Reviews, then records a reliable sync status.

This is an **attempt-based** integration challenge:

- You must implement the Google sync attempt flow.
- You must handle provider limitations correctly.
- You must still deliver a production-grade fallback path when direct sync is not possible.

---

## What We Provide

Use the supplied files in this package:

- `contracts.json` - API and schema definitions.
- `sample-events.json` - sample events and expected outcomes.
- `review-rubric.md` - internal scoring criteria (not required for implementation).

---

## Mandatory Implementation

### 1) Ingest feedback event

Handle a `SendFeedBack`-style event and normalize it for integration processing.

### 2) Evaluate eligibility

Use explicit rules to determine whether a Google sync attempt should be made.

### 3) Attempt Google sync

Execute provider call (or provider adapter call) and capture outcome.

### 4) Persist status

Store status by `feedbackId` using the provided status taxonomy:

- `SYNCED`
- `BLOCKED_BY_PROVIDER_POLICY`
- `FAILED_RETRYABLE`
- `FAILED_PERMANENT`
- `SKIPPED_NOT_ELIGIBLE`

### 5) Idempotency and retries

- Duplicate events for the same `feedbackId` must not duplicate side effects.
- Retry only retryable failures with bounded backoff.

### 6) Fallback path

If direct sync is unavailable, produce a fallback review-prompt path and store why.

---

## Required Endpoints

Implement these routes (or equivalent documented routes):

- `POST /integrations/google-reviews/sync`
- `GET /integrations/google-reviews/status/:feedbackId`
- `POST /integrations/google-reviews/retry/:feedbackId` (recommended)

Use the request/response structures from `contracts.json`.

---

## Deliverables

1. Runnable project code.
2. `README.md` with setup, run, and test steps.
3. Architecture note (1-2 pages): boundaries, idempotency, retry policy, fallback strategy.
4. Demonstration evidence:
   - success scenario,
   - provider-limited scenario,
   - duplicate-event scenario,
   - retry scenario.

---

## Constraints

- Keep scope realistic for 2 days.
- Functionality and reliability matter more than UI.
- Do not redesign base feedback contract; build from provided schemas.

---

## Submission Guidance

In `README.md`, include:

- assumptions,
- trade-offs,
- what you would improve with one extra week.

