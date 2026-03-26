import Database from 'better-sqlite3';
import { SyncOrchestrator } from '../../src/services/sync-orchestrator.service';
import { SyncStatusRepository } from '../../src/repositories/sync-status.repository';
import { SimulatedGoogleReviewsProvider } from '../../src/providers/google-reviews.provider';
import { SyncRequest, SyncStatus, ReasonCode, SimulateMode } from '../../src/types';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';

let db: Database.Database;
let repository: SyncStatusRepository;
let orchestrator: SyncOrchestrator;

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
    simulateMode: SimulateMode.FORCE_SYNCED,
    ...overrides,
  };
}

beforeEach(() => {
  db = setupTestDatabase();
  repository = new SyncStatusRepository(db);
  orchestrator = new SyncOrchestrator(repository, new SimulatedGoogleReviewsProvider());
});

afterEach(() => {
  teardownTestDatabase();
});

describe('SyncOrchestrator', () => {
  describe('happy path - successful sync', () => {
    it('should sync eligible feedback and return SYNCED status', async () => {
      const result = await orchestrator.process(buildRequest());

      expect(result.feedbackId).toBe('fb_test');
      expect(result.restaurantId).toBe('resto_test');
      expect(result.provider).toBe('google_reviews');
      expect(result.status).toBe(SyncStatus.SYNCED);
      expect(result.reasonCode).toBe(ReasonCode.ELIGIBLE_AND_SYNCED);
      expect(result.attemptCount).toBe(1);
      expect(result.fallback).toBeUndefined();
    });

    it('should persist the sync record to the database', async () => {
      await orchestrator.process(buildRequest());

      const record = repository.findByFeedbackId('fb_test');
      expect(record).not.toBeNull();
      expect(record!.status).toBe(SyncStatus.SYNCED);
      expect(record!.idempotencyKey).toBe('google_reviews:fb_test');
    });
  });

  describe('idempotency - duplicate events', () => {
    it('should return existing status for duplicate feedbackId', async () => {
      const request = buildRequest({ feedbackId: 'fb_dup' });

      const first = await orchestrator.process(request);
      const second = await orchestrator.process(request);

      expect(first.status).toBe(SyncStatus.SYNCED);
      expect(second.status).toBe(SyncStatus.SYNCED);
      expect(second.attemptCount).toBe(1); // Not incremented
    });

    it('should increment duplicate count on second call', async () => {
      const request = buildRequest({ feedbackId: 'fb_dup2' });

      await orchestrator.process(request);
      await orchestrator.process(request);

      const record = repository.findByFeedbackId('fb_dup2');
      expect(record!.duplicateCount).toBe(1);
    });

    it('should set duplicate flag to true on duplicate response', async () => {
      const request = buildRequest({ feedbackId: 'fb_dup_flag' });

      const first = await orchestrator.process(request);
      const second = await orchestrator.process(request);

      expect(first.duplicate).toBeUndefined();
      expect(second.duplicate).toBe(true);
    });

    it('should return duplicate for BLOCKED_BY_PROVIDER_POLICY record', async () => {
      const request = buildRequest({
        feedbackId: 'fb_dup_blocked',
        simulateMode: SimulateMode.FORCE_POLICY_BLOCK,
      });

      const first = await orchestrator.process(request);
      const second = await orchestrator.process(request);

      expect(first.status).toBe(SyncStatus.BLOCKED_BY_PROVIDER_POLICY);
      expect(second.status).toBe(SyncStatus.BLOCKED_BY_PROVIDER_POLICY);
      expect(second.duplicate).toBe(true);
      expect(second.attemptCount).toBe(1);
    });

    it('should return duplicate for FAILED_PERMANENT record', async () => {
      const request = buildRequest({
        feedbackId: 'fb_dup_perm',
        simulateMode: SimulateMode.FORCE_PERMANENT_FAILURE,
      });

      const first = await orchestrator.process(request);
      const second = await orchestrator.process(request);

      expect(first.status).toBe(SyncStatus.FAILED_PERMANENT);
      expect(second.status).toBe(SyncStatus.FAILED_PERMANENT);
      expect(second.duplicate).toBe(true);
    });

    it('should return duplicate for SKIPPED_NOT_ELIGIBLE record', async () => {
      const request = buildRequest({
        feedbackId: 'fb_dup_skip',
        isFeedbackNegative: true,
      });

      const first = await orchestrator.process(request);
      const second = await orchestrator.process(request);

      expect(first.status).toBe(SyncStatus.SKIPPED_NOT_ELIGIBLE);
      expect(second.status).toBe(SyncStatus.SKIPPED_NOT_ELIGIBLE);
      expect(second.duplicate).toBe(true);
    });

    it('should allow re-processing FAILED_RETRYABLE records (not terminal)', async () => {
      const request = buildRequest({
        feedbackId: 'fb_dup_retryable',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      });

      const first = await orchestrator.process(request);
      expect(first.status).toBe(SyncStatus.FAILED_RETRYABLE);
      expect(first.duplicate).toBeUndefined();

      // Second call should re-process, not be treated as duplicate
      const second = await orchestrator.process(request);
      expect(second.status).toBe(SyncStatus.FAILED_RETRYABLE);
      expect(second.duplicate).toBeUndefined();
      expect(second.attemptCount).toBe(2);
    });
  });

  describe('eligibility - skipped events', () => {
    it('should skip negative feedback', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_neg',
        isFeedbackNegative: true,
      }));

      expect(result.status).toBe(SyncStatus.SKIPPED_NOT_ELIGIBLE);
      expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_NEGATIVE_FEEDBACK);
      expect(result.attemptCount).toBe(0);
    });

    it('should skip low rating', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_low',
        rating: 2,
      }));

      expect(result.status).toBe(SyncStatus.SKIPPED_NOT_ELIGIBLE);
      expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_LOW_RATING);
      expect(result.attemptCount).toBe(0);
    });

    it('should skip when google sync is disabled', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_disabled',
        restoinfo: { googleSyncEnabled: false },
      }));

      expect(result.status).toBe(SyncStatus.SKIPPED_NOT_ELIGIBLE);
      expect(result.reasonCode).toBe(ReasonCode.NOT_ELIGIBLE_GOOGLE_DISABLED);
    });
  });

  describe('provider failures', () => {
    it('should return BLOCKED_BY_PROVIDER_POLICY with fallback', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_blocked',
        simulateMode: SimulateMode.FORCE_POLICY_BLOCK,
      }));

      expect(result.status).toBe(SyncStatus.BLOCKED_BY_PROVIDER_POLICY);
      expect(result.reasonCode).toBe(ReasonCode.CREATE_REVIEW_NOT_SUPPORTED);
      expect(result.fallback).toBeDefined();
      expect(result.fallback!.promptIssued).toBe(true);
      expect(result.fallback!.promptUrl).toBe('https://g.page/r/test/review');
    });

    it('should return FAILED_RETRYABLE for timeout', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_timeout',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      }));

      expect(result.status).toBe(SyncStatus.FAILED_RETRYABLE);
      expect(result.reasonCode).toBe(ReasonCode.PROVIDER_TIMEOUT);
      expect(result.attemptCount).toBe(1);
    });

    it('should return FAILED_RETRYABLE for rate limit', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_rate',
        simulateMode: SimulateMode.FORCE_RATE_LIMIT,
      }));

      expect(result.status).toBe(SyncStatus.FAILED_RETRYABLE);
      expect(result.reasonCode).toBe(ReasonCode.PROVIDER_RATE_LIMIT);
    });

    it('should return FAILED_PERMANENT for bad request', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_perm',
        simulateMode: SimulateMode.FORCE_PERMANENT_FAILURE,
      }));

      expect(result.status).toBe(SyncStatus.FAILED_PERMANENT);
      expect(result.reasonCode).toBe(ReasonCode.PROVIDER_BAD_REQUEST);
    });
  });

  describe('retry flow', () => {
    it('should allow re-processing of FAILED_RETRYABLE records', async () => {
      // First attempt - timeout
      await orchestrator.process(buildRequest({
        feedbackId: 'fb_retry',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      }));

      // Retry - now succeeds
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_retry',
        simulateMode: SimulateMode.FORCE_SYNCED,
      }));

      expect(result.status).toBe(SyncStatus.SYNCED);
      expect(result.attemptCount).toBe(2);
    });

    it('should increment attempt count on retry', async () => {
      await orchestrator.process(buildRequest({
        feedbackId: 'fb_retry2',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      }));

      await orchestrator.process(buildRequest({
        feedbackId: 'fb_retry2',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      }));

      const record = repository.findByFeedbackId('fb_retry2');
      expect(record!.attemptCount).toBe(2);
      expect(record!.status).toBe(SyncStatus.FAILED_RETRYABLE);
    });
  });

  describe('fallback generation', () => {
    it('should not generate fallback for successful sync', async () => {
      const result = await orchestrator.process(buildRequest());
      expect(result.fallback).toBeUndefined();
    });

    it('should generate fallback with promptUrl when google review URL exists', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_fb1',
        simulateMode: SimulateMode.FORCE_POLICY_BLOCK,
        restoinfo: {
          googleSyncEnabled: true,
          googleReviewUrl: 'https://g.page/r/my-restaurant/review',
        },
      }));

      expect(result.fallback!.promptUrl).toBe('https://g.page/r/my-restaurant/review');
      expect(result.fallback!.promptIssued).toBe(true);
      expect(result.fallback!.promptIssuedAt).toBeDefined();
    });

    it('should set promptIssued false when no google review URL', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_fb2',
        simulateMode: SimulateMode.FORCE_POLICY_BLOCK,
        restoinfo: { googleSyncEnabled: true },
      }));

      expect(result.fallback!.promptIssued).toBe(false);
      expect(result.fallback!.promptUrl).toBeUndefined();
      expect(result.fallback!.promptIssuedAt).toBeUndefined();
    });

    it('should not generate fallback for retryable failure', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_fb3',
        simulateMode: SimulateMode.FORCE_TIMEOUT,
      }));

      expect(result.fallback).toBeUndefined();
    });

    it('should not generate fallback for permanent failure', async () => {
      const result = await orchestrator.process(buildRequest({
        feedbackId: 'fb_fb4',
        simulateMode: SimulateMode.FORCE_PERMANENT_FAILURE,
      }));

      expect(result.fallback).toBeUndefined();
    });
  });

  describe('idempotency key format', () => {
    it('should generate key in format google_reviews:<feedbackId>', async () => {
      await orchestrator.process(buildRequest({ feedbackId: 'fb_key_test' }));

      const record = repository.findByFeedbackId('fb_key_test');
      expect(record!.idempotencyKey).toBe('google_reviews:fb_key_test');
    });
  });
});
