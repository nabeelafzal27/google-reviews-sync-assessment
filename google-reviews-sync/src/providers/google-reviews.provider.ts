import { SyncRequest, ProviderResult, SimulateMode, GoogleReviewsProvider, ReasonCode } from '../types';

/**
 * Simulated Google Reviews provider adapter.
 *
 * In production, this would make real HTTP calls to the Google Business
 * Profile API. For this assessment, behavior is driven by the `simulateMode`
 * field to enable deterministic testing of all provider outcomes.
 *
 * Key real-world context: Google does not offer a public API for
 * programmatically creating reviews. The most common production outcome
 * would be FORCE_POLICY_BLOCK, which triggers the fallback review-prompt path.
 */

/** Error code to reason code mapping, kept in sync with the ReasonCode enum. */
const ERROR_CODE_MAP: Readonly<Record<string, ReasonCode>> = {
  CREATE_REVIEW_NOT_SUPPORTED: ReasonCode.CREATE_REVIEW_NOT_SUPPORTED,
  PROVIDER_TIMEOUT: ReasonCode.PROVIDER_TIMEOUT,
  PROVIDER_RATE_LIMIT: ReasonCode.PROVIDER_RATE_LIMIT,
  PROVIDER_BAD_REQUEST: ReasonCode.PROVIDER_BAD_REQUEST,
  AUTH_INVALID: ReasonCode.AUTH_INVALID,
};

/**
 * Maps a raw provider error code to the corresponding ReasonCode enum.
 * Falls back to UNKNOWN_ERROR for unrecognized codes.
 */
export function mapErrorToReasonCode(errorCode: string): ReasonCode {
  return ERROR_CODE_MAP[errorCode] ?? ReasonCode.UNKNOWN_ERROR;
}

/**
 * Concrete provider implementation using simulation modes.
 * Implements the GoogleReviewsProvider interface so callers
 * can swap in a different adapter (e.g. real HTTP client) via DI.
 */
export class SimulatedGoogleReviewsProvider implements GoogleReviewsProvider {
  /** Attempt to sync feedback, returning a discriminated success/failure result. */
  async attemptSync(request: SyncRequest): Promise<ProviderResult> {
    const mode = request.simulateMode ?? SimulateMode.NONE;

    switch (mode) {
      case SimulateMode.FORCE_SYNCED:
      case SimulateMode.NONE:
        return { success: true };

      case SimulateMode.FORCE_POLICY_BLOCK:
        return {
          success: false,
          error: {
            code: 'CREATE_REVIEW_NOT_SUPPORTED',
            message: 'Google does not support programmatic review creation via API',
            isRetryable: false,
          },
        };

      case SimulateMode.FORCE_TIMEOUT:
        return {
          success: false,
          error: {
            code: 'PROVIDER_TIMEOUT',
            message: 'Request to Google API timed out after 30s',
            isRetryable: true,
          },
        };

      case SimulateMode.FORCE_RATE_LIMIT:
        return {
          success: false,
          error: {
            code: 'PROVIDER_RATE_LIMIT',
            message: 'Google API rate limit exceeded, retry after backoff',
            isRetryable: true,
          },
        };

      case SimulateMode.FORCE_PERMANENT_FAILURE:
        return {
          success: false,
          error: {
            code: 'PROVIDER_BAD_REQUEST',
            message: 'Invalid request parameters rejected by Google API',
            isRetryable: false,
          },
        };

      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `Unrecognized simulate mode: ${mode}`,
            isRetryable: false,
          },
        };
    }
  }
}

/**
 * Module-level convenience function that delegates to a shared provider instance.
 * Preserved for backward compatibility with existing call sites.
 */
const defaultProvider = new SimulatedGoogleReviewsProvider();

export async function attemptGoogleSync(request: SyncRequest): Promise<ProviderResult> {
  return defaultProvider.attemptSync(request);
}
