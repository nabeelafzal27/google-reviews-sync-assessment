import 'dotenv/config';
import { createApp } from './app';
import { getDatabase } from './db/connection';
import { runMigrations } from './db/migrations';
import { config, validateConfig } from './config';
import { logger } from './logger';

/**
 * Validate configuration before accepting any traffic.
 * Exits with a non-zero code when required settings are invalid
 * so container orchestrators can detect the failure immediately.
 */
const configErrors = validateConfig();

if (configErrors.length > 0) {
  for (const message of configErrors) {
    logger.error('Configuration error', { message });
  }
  process.exit(1);
}

const db = getDatabase();
runMigrations(db);

const app = createApp();
const port = config.server.port;

app.listen(port, () => {
  logger.info('Google Reviews Sync service started', {
    port,
    docsUrl: `http://localhost:${port}/api-docs`,
    healthUrl: `http://localhost:${port}/health`,
  });
});
