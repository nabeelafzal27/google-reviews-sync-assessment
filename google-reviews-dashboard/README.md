# Google Reviews Sync Dashboard

Angular frontend for the Google Reviews Sync integration service. Provides a visual interface to sync feedback, check statuses, retry failed syncs, and view sync history.

## Prerequisites

- Node.js 20+
- Angular CLI (`npm install -g @angular/cli`)
- Backend API running at `http://localhost:3000` (see `../google-reviews-sync/`)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
ng serve

# Open http://localhost:4200
```

Make sure the backend is running first:
```bash
cd ../google-reviews-sync
npm install && npm run build && npm start
```

## Features

| Tab | Description | API Endpoint |
|-----|-------------|--------------|
| **Sync Feedback** | Submit feedback events with configurable simulate modes | `POST /integrations/google-reviews/sync` |
| **Check Status** | Search by feedback ID to view sync status and fallback info | `GET /integrations/google-reviews/status/:feedbackId` |
| **Retry Failed** | Retry failed sync attempts with optional force override | `POST /integrations/google-reviews/retry/:feedbackId` |
| **Sync History** | Live table of all sync records with status badges (auto-refreshes) | `GET /integrations/google-reviews/list` |

## Key Behaviors

- **Form validation** — Required fields (Feedback ID, Restaurant ID, Rating) validated with inline error messages
- **Duplicate detection** — Submitting the same feedback ID twice shows a purple "Duplicate Event Detected" alert
- **Status badges** — Color-coded by status (green=synced, yellow=blocked, blue=retryable, red=permanent, grey=skipped)
- **Auto-refresh** — Sync History table refreshes automatically after each sync submission
- **Loading spinners** — Visual feedback during API calls
- **Error handling** — Centralized HTTP error interceptor with user-friendly messages

## Project Structure

```
src/app/
├── models/
│   └── sync.models.ts              # TypeScript interfaces for API types
├── services/
│   └── google-reviews.service.ts   # HTTP service for all API calls
├── interceptors/
│   └── error.interceptor.ts        # Centralized HTTP error handling
├── components/
│   ├── dashboard/                  # Main layout with tabs
│   ├── sync-form/                  # Feedback sync form
│   ├── status-viewer/              # Status lookup by feedback ID
│   ├── retry-panel/                # Retry failed syncs
│   ├── reviews-list/               # Sync history table
│   └── shared/
│       ├── status-badge/           # Reusable status badge component
│       └── loading-spinner/        # Reusable loading spinner
├── app.component.ts
├── app.config.ts                   # Providers (HTTP, router, interceptors)
└── app.routes.ts
```

## Environment Configuration

API base URL is configured in `src/environments/`:

- `environment.ts` — Production (`http://localhost:3000`)
- `environment.development.ts` — Development (`http://localhost:3000`)

## Build

```bash
# Development build
ng build

# Production build
ng build --configuration production
```

Output is in `dist/google-reviews-dashboard/`.

## Tech Stack

- **Angular 19** — Standalone components, signals, modern control flow (`@if`, `@for`, `@switch`)
- **TypeScript** — Strict mode
- **RxJS** — HTTP communication with `takeUntilDestroyed` for automatic cleanup
- **Angular HttpClient** — With functional interceptors (`HttpInterceptorFn`)
