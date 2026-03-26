import { Request, Response, NextFunction } from 'express';
import { SyncOrchestrator } from '../services/sync-orchestrator.service';
import { SyncStatusRepository } from '../repositories/sync-status.repository';
import { SimulatedGoogleReviewsProvider } from '../providers/google-reviews.provider';
import { canRetry, getMaxAttempts } from '../services/retry.service';
import { SyncRequest, SyncStatus, NotFoundError } from '../types';
import { getDatabase } from '../db/connection';
import { RequestWithContext } from '../middleware/request-context';
import { logger } from '../logger';

function getOrchestrator(): SyncOrchestrator {
  const db = getDatabase();
  const repository = new SyncStatusRepository(db);
  const provider = new SimulatedGoogleReviewsProvider();
  return new SyncOrchestrator(repository, provider);
}

function getRepository(): SyncStatusRepository {
  return new SyncStatusRepository(getDatabase());
}

/**
 * GET /integrations/google-reviews/list
 *
 * Returns all sync records, ordered by most recent first.
 */
export async function handleList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const records = getRepository().findAll(limit);

    res.status(200).json({
      total: records.length,
      records: records.map((r) => ({
        feedbackId: r.feedbackId,
        restaurantId: r.restaurantId,
        provider: r.provider,
        status: r.status,
        attemptCount: r.attemptCount,
        lastAttemptAt: r.lastAttemptAt,
        reasonCode: r.reasonCode,
        ...(r.fallback && { fallback: r.fallback }),
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/google-reviews/sync
 *
 * Accepts a feedback sync request, evaluates eligibility, attempts
 * provider sync, and returns the resulting status.
 */
export async function handleSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestId = (req as RequestWithContext).requestId;
    const syncRequest: SyncRequest = req.body;

    logger.info('Processing sync request', {
      requestId,
      feedbackId: syncRequest.feedbackId,
      restaurantId: syncRequest.restaurantId,
    });

    const orchestrator = getOrchestrator();
    const result = await orchestrator.process(syncRequest);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /integrations/google-reviews/status/:feedbackId
 *
 * Returns the current sync status for a given feedback event.
 * Throws NotFoundError when the feedbackId has no associated record.
 */
export async function handleGetStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const feedbackId = req.params.feedbackId as string;
    const record = getRepository().findByFeedbackId(feedbackId);

    if (!record) {
      throw new NotFoundError('SyncRecord', feedbackId);
    }

    res.status(200).json({
      feedbackId: record.feedbackId,
      restaurantId: record.restaurantId,
      provider: record.provider,
      status: record.status,
      attemptCount: record.attemptCount,
      lastAttemptAt: record.lastAttemptAt,
      reasonCode: record.reasonCode,
      ...(record.fallback && { fallback: record.fallback }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /integrations/google-reviews/retry/:feedbackId
 *
 * Manually retries a failed sync attempt. Only accepts retries for
 * FAILED_RETRYABLE records under the max attempt limit. Use `force: true`
 * in the body to override the retry limit check.
 */
export async function handleRetry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const feedbackId = req.params.feedbackId as string;
    const { force } = req.body || {};
    const repository = getRepository();
    const record = repository.findByFeedbackId(feedbackId);

    if (!record) {
      throw new NotFoundError('SyncRecord', feedbackId);
    }

    const retryAllowed = canRetry(record.attemptCount, record.status);

    if (!retryAllowed && !force) {
      const message = record.status === SyncStatus.FAILED_RETRYABLE
        ? `Maximum retry attempts (${getMaxAttempts()}) reached`
        : `Cannot retry record with status: ${record.status}`;

      res.status(200).json({ feedbackId, retryAccepted: false, message });
      return;
    }

    // Only FAILED_RETRYABLE records can be meaningfully retried
    if (record.status !== SyncStatus.FAILED_RETRYABLE) {
      res.status(200).json({
        feedbackId,
        retryAccepted: false,
        message: `Cannot retry record with terminal status: ${record.status}`,
      });
      return;
    }

    const retryRequest: SyncRequest = {
      feedbackId: record.feedbackId,
      restaurantId: record.restaurantId,
      rating: 5, // Only eligible (rating >= 4) records can reach FAILED_RETRYABLE
      isFeedbackNegative: false, // Only non-negative records can reach FAILED_RETRYABLE
      timestamp: new Date().toISOString(),
      restoinfo: {
        googleSyncEnabled: true, // Was enabled on the original attempt
        ...(record.fallback?.promptUrl && { googleReviewUrl: record.fallback.promptUrl }),
      },
    };

    const orchestrator = getOrchestrator();
    const result = await orchestrator.process(retryRequest);

    const wasRetried = result.attemptCount > record.attemptCount;

    res.status(200).json({
      feedbackId,
      retryAccepted: wasRetried,
      message: wasRetried
        ? `Retry attempt ${result.attemptCount} completed with status: ${result.status}`
        : `Record was not retried. Current status: ${result.status}`,
    });
  } catch (error) {
    next(error);
  }
}
