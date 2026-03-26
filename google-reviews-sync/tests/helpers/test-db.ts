import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrations';
import { setDatabase, closeDatabase } from '../../src/db/connection';

/**
 * Creates a fresh in-memory SQLite database for testing.
 * Runs migrations and injects it into the connection singleton.
 */
export function setupTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  setDatabase(db);
  return db;
}

/**
 * Tears down the test database.
 */
export function teardownTestDatabase(): void {
  closeDatabase();
}
