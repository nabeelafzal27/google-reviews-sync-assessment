import { getRetryDelay, canRetry, getMaxAttempts } from '../../src/services/retry.service';
import { SyncStatus } from '../../src/types';

describe('RetryService', () => {
  describe('getRetryDelay', () => {
    it('should return 2000ms for first attempt', () => {
      expect(getRetryDelay(1)).toBe(2000);
    });

    it('should return 4000ms for second attempt', () => {
      expect(getRetryDelay(2)).toBe(4000);
    });

    it('should return 8000ms for third attempt', () => {
      expect(getRetryDelay(3)).toBe(8000);
    });

    it('should cap delay at 30000ms', () => {
      expect(getRetryDelay(10)).toBe(30000);
    });

    it('should cap delay at maxDelayMs for very large attempt numbers', () => {
      expect(getRetryDelay(100)).toBe(30000);
    });
  });

  describe('canRetry', () => {
    it('should allow retry for FAILED_RETRYABLE with attempt count below max', () => {
      expect(canRetry(1, SyncStatus.FAILED_RETRYABLE)).toBe(true);
      expect(canRetry(2, SyncStatus.FAILED_RETRYABLE)).toBe(true);
    });

    it('should deny retry when max attempts reached', () => {
      expect(canRetry(3, SyncStatus.FAILED_RETRYABLE)).toBe(false);
    });

    it('should deny retry for SYNCED status', () => {
      expect(canRetry(1, SyncStatus.SYNCED)).toBe(false);
    });

    it('should deny retry for BLOCKED_BY_PROVIDER_POLICY', () => {
      expect(canRetry(1, SyncStatus.BLOCKED_BY_PROVIDER_POLICY)).toBe(false);
    });

    it('should deny retry for FAILED_PERMANENT', () => {
      expect(canRetry(1, SyncStatus.FAILED_PERMANENT)).toBe(false);
    });

    it('should deny retry for SKIPPED_NOT_ELIGIBLE', () => {
      expect(canRetry(1, SyncStatus.SKIPPED_NOT_ELIGIBLE)).toBe(false);
    });
  });

  describe('getMaxAttempts', () => {
    it('should return 3', () => {
      expect(getMaxAttempts()).toBe(3);
    });
  });
});
