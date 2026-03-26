/**
 * Business rules and configuration constants.
 * Values sourced from the contracts.json specification.
 *
 * The config object is frozen at module load time to prevent
 * accidental mutation during request handling.
 */

export interface AppConfig {
  readonly server: { readonly port: number };
  readonly eligibility: {
    readonly minimumRatingToAttemptGoogleSync: number;
    readonly skipWhenIsFeedbackNegative: boolean;
    readonly respectRestaurantGoogleSyncEnabled: boolean;
  };
  readonly retryPolicy: {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly backoffMultiplier: number;
    readonly maxDelayMs: number;
  };
  readonly idempotency: {
    readonly keyTemplate: (feedbackId: string) => string;
    readonly duplicateHandling: 'RETURN_EXISTING_STATUS';
  };
  readonly database: { readonly path: string };
}

const rawConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },

  eligibility: {
    minimumRatingToAttemptGoogleSync: 4,
    skipWhenIsFeedbackNegative: true,
    respectRestaurantGoogleSyncEnabled: true,
  },

  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
  },

  idempotency: {
    keyTemplate: (feedbackId: string) => `google_reviews:${feedbackId}`,
    duplicateHandling: 'RETURN_EXISTING_STATUS',
  },

  database: {
    path: process.env.DB_PATH || './data/sync.db',
  },
};

export const config: Readonly<AppConfig> = Object.freeze(rawConfig);

/**
 * Validates that all configuration values are sensible.
 * Call at startup to fail fast before accepting traffic.
 *
 * @returns An array of validation error messages (empty if valid).
 */
export function validateConfig(): readonly string[] {
  const errors: string[] = [];

  if (!Number.isFinite(config.server.port) || config.server.port <= 0 || config.server.port > 65535) {
    errors.push(`Invalid server port: ${config.server.port}`);
  }

  if (config.retryPolicy.maxAttempts < 1) {
    errors.push(`Retry maxAttempts must be >= 1, got: ${config.retryPolicy.maxAttempts}`);
  }

  if (config.retryPolicy.initialDelayMs <= 0) {
    errors.push(`Retry initialDelayMs must be > 0, got: ${config.retryPolicy.initialDelayMs}`);
  }

  if (config.eligibility.minimumRatingToAttemptGoogleSync < 0 ||
      config.eligibility.minimumRatingToAttemptGoogleSync > 5) {
    errors.push(
      `Minimum rating must be 0-5, got: ${config.eligibility.minimumRatingToAttemptGoogleSync}`
    );
  }

  if (!config.database.path) {
    errors.push('Database path must not be empty');
  }

  return errors;
}
