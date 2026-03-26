import Database from 'better-sqlite3';

/**
 * Run database migrations. Creates tables if they don't exist.
 * Safe to call multiple times (idempotent).
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_status (
      feedback_id       TEXT PRIMARY KEY,
      restaurant_id     TEXT NOT NULL,
      provider          TEXT NOT NULL DEFAULT 'google_reviews',
      status            TEXT NOT NULL,
      attempt_count     INTEGER NOT NULL DEFAULT 0,
      last_attempt_at   TEXT,
      reason_code       TEXT NOT NULL,
      last_error        TEXT,
      fallback          TEXT,
      idempotency_key   TEXT NOT NULL UNIQUE,
      first_processed_at TEXT NOT NULL,
      duplicate_count   INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status_status
      ON sync_status(status);

    CREATE INDEX IF NOT EXISTS idx_sync_status_restaurant
      ON sync_status(restaurant_id);
  `);
}
