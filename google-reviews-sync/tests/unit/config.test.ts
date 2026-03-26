import { config, validateConfig } from '../../src/config';

describe('Config', () => {
  describe('default values', () => {
    it('should have minimum rating of 4', () => {
      expect(config.eligibility.minimumRatingToAttemptGoogleSync).toBe(4);
    });

    it('should skip negative feedback by default', () => {
      expect(config.eligibility.skipWhenIsFeedbackNegative).toBe(true);
    });

    it('should respect restaurant google sync enabled flag', () => {
      expect(config.eligibility.respectRestaurantGoogleSyncEnabled).toBe(true);
    });

    it('should have max 3 retry attempts', () => {
      expect(config.retryPolicy.maxAttempts).toBe(3);
    });

    it('should have 2000ms initial delay', () => {
      expect(config.retryPolicy.initialDelayMs).toBe(2000);
    });

    it('should have backoff multiplier of 2', () => {
      expect(config.retryPolicy.backoffMultiplier).toBe(2);
    });

    it('should have max delay of 30000ms', () => {
      expect(config.retryPolicy.maxDelayMs).toBe(30000);
    });

    it('should generate correct idempotency key', () => {
      expect(config.idempotency.keyTemplate('fb_123')).toBe('google_reviews:fb_123');
    });

    it('should have RETURN_EXISTING_STATUS duplicate handling', () => {
      expect(config.idempotency.duplicateHandling).toBe('RETURN_EXISTING_STATUS');
    });
  });

  describe('validateConfig', () => {
    it('should return no errors for default config', () => {
      const errors = validateConfig();
      expect(errors).toEqual([]);
    });
  });
});
