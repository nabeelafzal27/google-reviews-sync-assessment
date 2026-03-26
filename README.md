# Google Reviews Sync — Integration Assessment

Submission for the **Senior Integrations Engineer** assessment. A service that receives restaurant feedback events and attempts to sync positive reviews to Google Reviews, with robust error handling, idempotency, retry logic, and fallback paths.

## Repository Structure

```
├── google-reviews-sync/        # Backend API (Node.js + Express + TypeScript)
├── google-reviews-dashboard/   # Frontend Dashboard (Angular 19)
├── contracts.json              # API and schema definitions (provided)
├── sample-events.json          # Sample test events (provided)
└── assessment-brief.md         # Assessment requirements (provided)
```

## Quick Start

### Backend (required)

```bash
cd google-reviews-sync
npm install
cp .env.example .env
npm run build
npm test          # 123 tests pass
npm start         # http://localhost:3000
```

- **API:** http://localhost:3000/integrations/google-reviews/sync
- **Swagger Docs:** http://localhost:3000/api-docs
- **Architecture Notes:** [google-reviews-sync/docs/architecture.md](google-reviews-sync/docs/architecture.md)

### Frontend (bonus)

```bash
cd google-reviews-dashboard
npm install
ng serve           # http://localhost:4200
```

> Make sure the backend is running first on port 3000.

## What's Implemented

| Requirement | Status |
|-------------|--------|
| 1. Ingest feedback event | Done |
| 2. Evaluate eligibility (rating, negative, google enabled) | Done |
| 3. Attempt Google sync via provider adapter | Done |
| 4. Persist status (SYNCED, BLOCKED, RETRYABLE, PERMANENT, SKIPPED) | Done |
| 5. Idempotency and retries with bounded backoff | Done |
| 6. Fallback review-prompt path | Done |
| POST /integrations/google-reviews/sync | Done |
| GET /integrations/google-reviews/status/:feedbackId | Done |
| POST /integrations/google-reviews/retry/:feedbackId | Done |
| All 8 sample event cases passing | Done |
| README with setup, assumptions, trade-offs | Done |
| Architecture doc (boundaries, idempotency, retry, fallback) | Done |
| Demo evidence (success, policy-block, duplicate, retry) | Done |

## Detailed Documentation

- **Backend README:** [google-reviews-sync/README.md](google-reviews-sync/README.md) — setup, demo curl commands, assumptions, trade-offs, improvements
- **Architecture:** [google-reviews-sync/docs/architecture.md](google-reviews-sync/docs/architecture.md) — system design, idempotency, retry policy, fallback strategy
- **Frontend README:** [google-reviews-dashboard/README.md](google-reviews-dashboard/README.md) — setup, features, project structure
