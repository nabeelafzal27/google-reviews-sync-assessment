import Database from 'better-sqlite3';
import { SyncStatusRecord, SyncStatus, ReasonCode, LastError, FallbackInfo, NotFoundError } from '../types';
import { logger } from '../logger';

interface DbRow {
  readonly feedback_id: string;
  readonly restaurant_id: string;
  readonly provider: string;
  readonly status: string;
  readonly attempt_count: number;
  readonly last_attempt_at: string | null;
  readonly reason_code: string;
  readonly last_error: string | null;
  readonly fallback: string | null;
  readonly idempotency_key: string;
  readonly first_processed_at: string;
  readonly duplicate_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Converts a snake_case database row into the camelCase domain record. */
function rowToRecord(row: DbRow): SyncStatusRecord {
  return {
    feedbackId: row.feedback_id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    status: row.status as SyncStatus,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    reasonCode: row.reason_code as ReasonCode,
    lastError: row.last_error ? JSON.parse(row.last_error) as LastError : null,
    fallback: row.fallback ? JSON.parse(row.fallback) as FallbackInfo : null,
    idempotencyKey: row.idempotency_key,
    firstProcessedAt: row.first_processed_at,
    duplicateCount: row.duplicate_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SyncStatusRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Return all sync records, ordered by most recent first. */
  findAll(limit = 50): SyncStatusRecord[] {
    const stmt = this.db.prepare('SELECT * FROM sync_status ORDER BY updated_at DESC LIMIT ?');
    const rows = stmt.all(limit) as DbRow[];
    return rows.map(rowToRecord);
  }

  /** Look up a sync record by its feedback ID. Returns null when no match exists. */
  findByFeedbackId(feedbackId: string): SyncStatusRecord | null {
    const stmt = this.db.prepare('SELECT * FROM sync_status WHERE feedback_id = ?');
    const row = stmt.get(feedbackId) as DbRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  /** Persist a new sync status record. */
  create(record: Readonly<SyncStatusRecord>): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_status (
        feedback_id, restaurant_id, provider, status, attempt_count,
        last_attempt_at, reason_code, last_error, fallback,
        idempotency_key, first_processed_at, duplicate_count,
        created_at, updated_at
      ) VALUES (
        @feedbackId, @restaurantId, @provider, @status, @attemptCount,
        @lastAttemptAt, @reasonCode, @lastError, @fallback,
        @idempotencyKey, @firstProcessedAt, @duplicateCount,
        @createdAt, @updatedAt
      )
    `);

    stmt.run({
      feedbackId: record.feedbackId,
      restaurantId: record.restaurantId,
      provider: record.provider,
      status: record.status,
      attemptCount: record.attemptCount,
      lastAttemptAt: record.lastAttemptAt,
      reasonCode: record.reasonCode,
      lastError: record.lastError ? JSON.stringify(record.lastError) : null,
      fallback: record.fallback ? JSON.stringify(record.fallback) : null,
      idempotencyKey: record.idempotencyKey,
      firstProcessedAt: record.firstProcessedAt,
      duplicateCount: record.duplicateCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    logger.debug('Created sync status record', { feedbackId: record.feedbackId, status: record.status });
  }

  /**
   * Partially update an existing sync status record.
   * Merges supplied fields with the current record and bumps updatedAt.
   *
   * @throws NotFoundError if no record exists for the given feedbackId.
   */
  update(feedbackId: string, updates: Partial<SyncStatusRecord>): void {
    const existing = this.findByFeedbackId(feedbackId);
    if (!existing) {
      throw new NotFoundError('SyncStatusRecord', feedbackId);
    }

    const now = new Date().toISOString();
    const merged = { ...existing, ...updates, updatedAt: now };

    const stmt = this.db.prepare(`
      UPDATE sync_status SET
        status = @status,
        attempt_count = @attemptCount,
        last_attempt_at = @lastAttemptAt,
        reason_code = @reasonCode,
        last_error = @lastError,
        fallback = @fallback,
        duplicate_count = @duplicateCount,
        updated_at = @updatedAt
      WHERE feedback_id = @feedbackId
    `);

    stmt.run({
      feedbackId: merged.feedbackId,
      status: merged.status,
      attemptCount: merged.attemptCount,
      lastAttemptAt: merged.lastAttemptAt,
      reasonCode: merged.reasonCode,
      lastError: merged.lastError ? JSON.stringify(merged.lastError) : null,
      fallback: merged.fallback ? JSON.stringify(merged.fallback) : null,
      duplicateCount: merged.duplicateCount,
      updatedAt: merged.updatedAt,
    });

    logger.debug('Updated sync status record', { feedbackId, status: merged.status });
  }

  /** Atomically increment the duplicate event counter for idempotency tracking. */
  incrementDuplicateCount(feedbackId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sync_status
      SET duplicate_count = duplicate_count + 1,
          updated_at = @updatedAt
      WHERE feedback_id = @feedbackId
    `);

    stmt.run({
      feedbackId,
      updatedAt: new Date().toISOString(),
    });

    logger.debug('Incremented duplicate count', { feedbackId });
  }
}
