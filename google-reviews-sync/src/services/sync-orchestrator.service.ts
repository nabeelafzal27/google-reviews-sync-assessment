import {
  SyncRequest,
  SyncResponse,
  SyncStatus,
  ReasonCode,
  SyncStatusRecord,
  FallbackInfo,
  GoogleReviewsProvider,
  ProviderResult,
  TERMINAL_STATUSES,
  PROVIDER_NAME,
} from '../types';
import { config } from '../config';
import { SyncStatusRepository } from '../repositories/sync-status.repository';
import { evaluateEligibility } from './eligibility.service';
import { mapErrorToReasonCode } from '../providers/google-reviews.provider';

export class SyncOrchestrator {
  private readonly repository: SyncStatusRepository;
  private readonly provider: GoogleReviewsProvider;

  constructor(repository: SyncStatusRepository, provider: GoogleReviewsProvider) {
    this.repository = repository;
    this.provider = provider;
  }

  /**
   * Main sync processing pipeline.
   *
   * Reads like a narrative of the business flow:
   * check for duplicates, evaluate eligibility, call the provider,
   * build a fallback when needed, and persist the outcome.
   */
  async process(request: Readonly<SyncRequest>): Promise<SyncResponse> {
    const idempotencyKey = config.idempotency.keyTemplate(request.feedbackId);
    const now = new Date().toISOString();
    const existing = this.repository.findByFeedbackId(request.feedbackId);

    const duplicateResponse = this.checkIdempotency(existing);
    if (duplicateResponse) {
      return duplicateResponse;
    }

    const skipResponse = this.evaluateAndSkip(request, idempotencyKey, now);
    if (skipResponse) {
      return skipResponse;
    }

    const attemptCount = existing ? existing.attemptCount + 1 : 1;
    const providerResult = await this.provider.attemptSync(request);

    const { status, reasonCode, fallback } = this.resolveOutcome(providerResult, request);

    return this.persistResult({
      feedbackId: request.feedbackId,
      restaurantId: request.restaurantId,
      status,
      reasonCode,
      attemptCount,
      lastAttemptAt: now,
      lastError: providerResult.success ? null : providerResult.error,
      fallback,
      idempotencyKey,
      now,
      existing,
    });
  }

  // -------------------------------------------------------------------
  // Private pipeline steps
  // -------------------------------------------------------------------

  /**
   * Returns the existing response when a terminal record already exists,
   * preventing duplicate side effects for the same feedback event.
   */
  private checkIdempotency(existing: SyncStatusRecord | null): SyncResponse | null {
    if (!existing || !TERMINAL_STATUSES.has(existing.status)) {
      return null;
    }

    this.repository.incrementDuplicateCount(existing.feedbackId);
    return { ...this.toResponse(existing), duplicate: true };
  }

  /**
   * Short-circuits processing when the feedback does not meet
   * the eligibility criteria (negative sentiment, low rating, etc.).
   */
  private evaluateAndSkip(
    request: Readonly<SyncRequest>,
    idempotencyKey: string,
    now: string,
  ): SyncResponse | null {
    const eligibility = evaluateEligibility(request);

    if (eligibility.eligible) {
      return null;
    }

    const record = this.buildRecord({
      feedbackId: request.feedbackId,
      restaurantId: request.restaurantId,
      status: SyncStatus.SKIPPED_NOT_ELIGIBLE,
      reasonCode: eligibility.reasonCode,
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
      fallback: null,
      idempotencyKey,
      now,
    });

    this.repository.create(record);
    return this.toResponse(record);
  }

  /**
   * Maps the provider result into the appropriate sync status, reason code,
   * and optional fallback. Centralises the branching so process() stays flat.
   */
  private resolveOutcome(
    result: ProviderResult,
    request: Readonly<SyncRequest>,
  ): { status: SyncStatus; reasonCode: ReasonCode; fallback: FallbackInfo | null } {
    if (result.success) {
      return { status: SyncStatus.SYNCED, reasonCode: ReasonCode.ELIGIBLE_AND_SYNCED, fallback: null };
    }

    const errorCode = result.error.code;
    const reasonCode = mapErrorToReasonCode(errorCode);

    if (errorCode === 'CREATE_REVIEW_NOT_SUPPORTED') {
      return {
        status: SyncStatus.BLOCKED_BY_PROVIDER_POLICY,
        reasonCode,
        fallback: this.buildFallback(request),
      };
    }

    if (result.error.isRetryable) {
      return { status: SyncStatus.FAILED_RETRYABLE, reasonCode, fallback: null };
    }

    return { status: SyncStatus.FAILED_PERMANENT, reasonCode, fallback: null };
  }

  /**
   * Generates a fallback review-prompt when direct sync is not possible.
   * Uses the restaurant's Google Review URL so the user can leave a review manually.
   */
  private buildFallback(request: Readonly<SyncRequest>): FallbackInfo {
    const googleReviewUrl = request.restoinfo?.googleReviewUrl;

    return {
      promptUrl: googleReviewUrl || undefined,
      promptIssued: !!googleReviewUrl,
      promptIssuedAt: googleReviewUrl ? new Date().toISOString() : undefined,
    };
  }

  /** Creates or updates the database record and returns the API response. */
  private persistResult(params: {
    feedbackId: string;
    restaurantId: string;
    status: SyncStatus;
    reasonCode: ReasonCode;
    attemptCount: number;
    lastAttemptAt: string;
    lastError: { readonly code: string; readonly message: string; readonly isRetryable: boolean } | null;
    fallback: FallbackInfo | null;
    idempotencyKey: string;
    now: string;
    existing: SyncStatusRecord | null;
  }): SyncResponse {
    const record = this.buildRecord(params);

    if (params.existing) {
      this.repository.update(params.feedbackId, {
        status: record.status,
        attemptCount: record.attemptCount,
        lastAttemptAt: record.lastAttemptAt,
        reasonCode: record.reasonCode,
        lastError: record.lastError,
        fallback: record.fallback,
      });
    } else {
      this.repository.create(record);
    }

    return this.toResponse(record);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private buildRecord(params: {
    feedbackId: string;
    restaurantId: string;
    status: SyncStatus;
    reasonCode: ReasonCode;
    attemptCount: number;
    lastAttemptAt: string | null;
    lastError: { readonly code: string; readonly message: string; readonly isRetryable: boolean } | null;
    fallback: FallbackInfo | null;
    idempotencyKey: string;
    now: string;
  }): SyncStatusRecord {
    return {
      feedbackId: params.feedbackId,
      restaurantId: params.restaurantId,
      provider: PROVIDER_NAME,
      status: params.status,
      attemptCount: params.attemptCount,
      lastAttemptAt: params.lastAttemptAt,
      reasonCode: params.reasonCode,
      lastError: params.lastError,
      fallback: params.fallback,
      idempotencyKey: params.idempotencyKey,
      firstProcessedAt: params.now,
      duplicateCount: 0,
      createdAt: params.now,
      updatedAt: params.now,
    };
  }

  private toResponse(record: Readonly<SyncStatusRecord>): SyncResponse {
    const response: SyncResponse = {
      feedbackId: record.feedbackId,
      restaurantId: record.restaurantId,
      provider: PROVIDER_NAME,
      status: record.status,
      attemptCount: record.attemptCount,
      lastAttemptAt: record.lastAttemptAt || record.createdAt,
      reasonCode: record.reasonCode,
    };

    if (record.fallback) {
      return { ...response, fallback: record.fallback };
    }

    return response;
  }
}
