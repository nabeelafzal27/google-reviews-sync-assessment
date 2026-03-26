import { SyncRequest, EligibilityResult, ReasonCode } from '../types';
import { config } from '../config';

/**
 * Evaluates whether a feedback event is eligible for Google Reviews sync.
 *
 * Check order reflects business priority and is intentional:
 * 1. Negative feedback is always skipped (regardless of rating)
 * 2. Low rating below threshold is skipped
 * 3. Restaurant-level google sync must be enabled
 * 4. All checks pass = eligible
 *
 * The ordering matters because the reported reason code should reflect
 * the highest-priority disqualification, not just the first one found.
 */
export function evaluateEligibility(request: Readonly<SyncRequest>): EligibilityResult {
  if (config.eligibility.skipWhenIsFeedbackNegative && request.isFeedbackNegative) {
    return { eligible: false, reasonCode: ReasonCode.NOT_ELIGIBLE_NEGATIVE_FEEDBACK };
  }

  if (request.rating < config.eligibility.minimumRatingToAttemptGoogleSync) {
    return { eligible: false, reasonCode: ReasonCode.NOT_ELIGIBLE_LOW_RATING };
  }

  if (config.eligibility.respectRestaurantGoogleSyncEnabled) {
    if (request.restoinfo?.googleSyncEnabled === false) {
      return { eligible: false, reasonCode: ReasonCode.NOT_ELIGIBLE_GOOGLE_DISABLED };
    }
  }

  return { eligible: true };
}
