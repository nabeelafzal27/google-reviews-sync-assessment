import { SyncStatus } from '../types';
import { config } from '../config';

const { maxAttempts, initialDelayMs, backoffMultiplier, maxDelayMs } = config.retryPolicy;

/**
 * Calculate the delay before the next retry attempt.
 * Uses exponential backoff: delay = min(initialDelay * multiplier^(attempt-1), maxDelay)
 *
 * @param attemptNumber - 1-based attempt number (1 = first retry)
 */
export function getRetryDelay(attemptNumber: number): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Determine whether a sync record can be retried.
 *
 * Only FAILED_RETRYABLE records that have not exhausted the attempt
 * budget are eligible for another try. All other statuses (including
 * terminal successes and permanent failures) are ineligible.
 */
export function canRetry(attemptCount: number, status: SyncStatus): boolean {
  return status === SyncStatus.FAILED_RETRYABLE && attemptCount < maxAttempts;
}

/** Returns the configured maximum number of retry attempts. */
export function getMaxAttempts(): number {
  return maxAttempts;
}
