import { evaluateEligibility } from '../../src/services/eligibility.service';
import { SyncRequest, ReasonCode } from '../../src/types';

function buildRequest(overrides: Partial<SyncRequest> = {}): SyncRequest {
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
    ...overrides,
  };
}

describe('EligibilityService', () => {
  describe('eligible feedback', () => {
    it('should return eligible for high-rating positive feedback with google enabled', () => {
      const result = evaluateEligibility(buildRequest());
      expect(result.eligible).toBe(true);
    });

    it('should return eligible for rating exactly at threshold (4)', () => {
      const result = evaluateEligibility(buildRequest({ rating: 4 }));
      expect(result.eligible).toBe(true);
    });

    it('should return eligible for maximum rating (5)', () => {
      const result = evaluateEligibility(buildRequest({ rating: 5 }));
      expect(result.eligible).toBe(true);
    });

    it('should return eligible when restoinfo is entirely missing', () => {
      const request = buildRequest();
      // Remove restoinfo completely - undefined means not explicitly disabled
      const { restoinfo, ...withoutRestoinfo } = request;
      const result = evaluateEligibility(withoutRestoinfo as SyncRequest);
      expect(result.eligible).toBe(true);
    });

    it('should return eligible when googleSyncEnabled is explicitly true', () => {
      const result = evaluateEligibility(buildRequest({
        restoinfo: { googleSyncEnabled: true },
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('negative feedback', () => {
    it('should skip negative feedback regardless of rating', () => {
      const result = evaluateEligibility(buildRequest({ isFeedbackNegative: true, rating: 5 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_NEGATIVE_FEEDBACK);
      }
    });

    it('should prioritize negative check over low rating', () => {
      const result = evaluateEligibility(buildRequest({ isFeedbackNegative: true, rating: 1 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_NEGATIVE_FEEDBACK);
      }
    });
  });

  describe('low rating', () => {
    it('should skip rating below threshold (3)', () => {
      const result = evaluateEligibility(buildRequest({ rating: 3 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      }
    });

    it('should skip rating of 0', () => {
      const result = evaluateEligibility(buildRequest({ rating: 0 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      }
    });

    it('should skip rating of 1', () => {
      const result = evaluateEligibility(buildRequest({ rating: 1 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      }
    });

    it('should skip rating of 2', () => {
      const result = evaluateEligibility(buildRequest({ rating: 2 }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      }
    });
  });

  describe('google sync disabled', () => {
    it('should skip when restaurant has google sync disabled', () => {
      const result = evaluateEligibility(buildRequest({
        restoinfo: { googleSyncEnabled: false },
      }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_GOOGLE_DISABLED);
      }
    });

    it('should be eligible when googleSyncEnabled is undefined (not explicitly disabled)', () => {
      const result = evaluateEligibility(buildRequest({
        restoinfo: { googleReviewUrl: 'https://g.page/r/test/review' },
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('check order', () => {
    it('should check negative before rating before google enabled', () => {
      const result = evaluateEligibility(buildRequest({
        isFeedbackNegative: true,
        rating: 1,
        restoinfo: { googleSyncEnabled: false },
      }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_NEGATIVE_FEEDBACK);
      }
    });

    it('should check low rating before google disabled', () => {
      const result = evaluateEligibility(buildRequest({
        rating: 2,
        restoinfo: { googleSyncEnabled: false },
      }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      }
    });
  });
});
