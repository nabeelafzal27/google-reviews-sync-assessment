import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../logger';

let dbInstance: Database.Database | null = null;

/**
 * Returns a singleton database connection.
 *
 * On first call, creates the connection and enables WAL mode for better
 * concurrent read throughput. Pass ':memory:' for in-memory databases
 * (primarily used in tests).
 */
export function getDatabase(filePath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = filePath || process.env.DB_PATH || './data/sync.db';

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Created database directory', { dir });
    }
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  logger.info('Database connection established', { path: dbPath });

  return dbInstance;
}

/**
 * Close the current database connection and reset the singleton.
 * Primarily used in tests for cleanup between runs.
 */
export function closeDatabase(): void {
  if (!dbInstance) {
    return;
  }

  dbInstance.close();
  dbInstance = null;
  logger.debug('Database connection closed');
}

/**
 * Replace the singleton with an externally created database.
 * Used in tests to inject an in-memory database.
 */
export function setDatabase(db: Database.Database): void {
  dbInstance = db;
}
