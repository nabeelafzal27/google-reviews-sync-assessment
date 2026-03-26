import { SimulatedGoogleReviewsProvider, mapErrorToReasonCode } from '../../src/providers/google-reviews.provider';
import { SyncRequest, SimulateMode, ReasonCode } from '../../src/types';

function buildRequest(simulateMode?: SimulateMode): SyncRequest {
  return {
    feedbackId: 'fb_test',
    restaurantId: 'resto_test',
    rating: 5,
    isFeedbackNegative: false,
    timestamp: '2026-03-25T12:00:00.000Z',
    restoinfo: {
      googleSyncEnabled: true,
      googleReviewUrl: 'https://g.page/r/test/review',
    },
    simulateMode,
  };
}

describe('GoogleReviewsProvider', () => {
  const provider = new SimulatedGoogleReviewsProvider();

  it('should return success for FORCE_SYNCED', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.FORCE_SYNCED));
    expect(result.success).toBe(true);
  });

  it('should return success for NONE (default)', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.NONE));
    expect(result.success).toBe(true);
  });

  it('should return success when simulateMode is undefined', async () => {
    const result = await provider.attemptSync(buildRequest(undefined));
    expect(result.success).toBe(true);
  });

  it('should return policy block for FORCE_POLICY_BLOCK', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.FORCE_POLICY_BLOCK));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CREATE_REVIEW_NOT_SUPPORTED');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('should return timeout for FORCE_TIMEOUT', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.FORCE_TIMEOUT));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PROVIDER_TIMEOUT');
      expect(result.error.isRetryable).toBe(true);
    }
  });

  it('should return rate limit for FORCE_RATE_LIMIT', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.FORCE_RATE_LIMIT));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PROVIDER_RATE_LIMIT');
      expect(result.error.isRetryable).toBe(true);
    }
  });

  it('should return permanent failure for FORCE_PERMANENT_FAILURE', async () => {
    const result = await provider.attemptSync(buildRequest(SimulateMode.FORCE_PERMANENT_FAILURE));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PROVIDER_BAD_REQUEST');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('should return failure with UNKNOWN_ERROR for unrecognized simulate mode', async () => {
    const request = { ...buildRequest(undefined), simulateMode: 'INVALID_MODE' as SimulateMode };
    const result = await provider.attemptSync(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
      expect(result.error.isRetryable).toBe(false);
    }
  });
});

describe('mapErrorToReasonCode', () => {
  it('should map CREATE_REVIEW_NOT_SUPPORTED to correct reason code', () => {
    expect(mapErrorToReasonCode('CREATE_REVIEW_NOT_SUPPORTED')).toBe(ReasonCode.CREATE_REVIEW_NOT_SUPPORTED);
  });

  it('should map PROVIDER_TIMEOUT to correct reason code', () => {
    expect(mapErrorToReasonCode('PROVIDER_TIMEOUT')).toBe(ReasonCode.PROVIDER_TIMEOUT);
  });

  it('should map PROVIDER_RATE_LIMIT to correct reason code', () => {
    expect(mapErrorToReasonCode('PROVIDER_RATE_LIMIT')).toBe(ReasonCode.PROVIDER_RATE_LIMIT);
  });

  it('should map PROVIDER_BAD_REQUEST to correct reason code', () => {
    expect(mapErrorToReasonCode('PROVIDER_BAD_REQUEST')).toBe(ReasonCode.PROVIDER_BAD_REQUEST);
  });

  it('should map AUTH_INVALID to correct reason code', () => {
    expect(mapErrorToReasonCode('AUTH_INVALID')).toBe(ReasonCode.AUTH_INVALID);
  });

  it('should return UNKNOWN_ERROR for unrecognized error code', () => {
    expect(mapErrorToReasonCode('SOME_NEW_ERROR')).toBe(ReasonCode.UNKNOWN_ERROR);
  });

  it('should return UNKNOWN_ERROR for empty string', () => {
    expect(mapErrorToReasonCode('')).toBe(ReasonCode.UNKNOWN_ERROR);
  });
});
