import { Router } from 'express';
import { handleSync, handleGetStatus, handleRetry, handleList } from '../controllers/google-reviews.controller';
import { validateRequest } from '../middleware/request-validator';

const router = Router();

/**
 * JSON Schema for the sync request payload.
 * Derived from the contracts.json googleSyncAttempt definition.
 */
const syncRequestSchema = {
  type: 'object' as const,
  required: ['feedbackId', 'restaurantId', 'rating', 'isFeedbackNegative', 'timestamp'],
  properties: {
    feedbackId: { type: 'string' as const, minLength: 1 },
    restaurantId: { type: 'string' as const, minLength: 1 },
    rating: { type: 'number' as const, minimum: 0, maximum: 5 },
    isFeedbackNegative: { type: 'boolean' as const },
    timestamp: { type: 'string' as const, format: 'date-time' },
    restoinfo: {
      type: 'object' as const,
      properties: {
        googleReviewUrl: { type: 'string' as const },
        googlePlaceId: { type: 'string' as const },
        googleSyncEnabled: { type: 'boolean' as const },
      },
      additionalProperties: true,
    },
    simulateMode: {
      type: 'string' as const,
      enum: [
        'NONE',
        'FORCE_SYNCED',
        'FORCE_POLICY_BLOCK',
        'FORCE_TIMEOUT',
        'FORCE_RATE_LIMIT',
        'FORCE_PERMANENT_FAILURE',
      ],
    },
  },
  additionalProperties: true,
} as const;

/**
 * @swagger
 * /integrations/google-reviews/sync:
 *   post:
 *     summary: Attempt to sync feedback to Google Reviews
 *     description: >
 *       Accepts a feedback event, evaluates eligibility, attempts Google sync,
 *       and returns the sync status. Handles idempotency (duplicate events return existing status).
 *     tags: [Google Reviews Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feedbackId, restaurantId, rating, isFeedbackNegative, timestamp]
 *             properties:
 *               feedbackId:
 *                 type: string
 *                 example: "fb_001"
 *               restaurantId:
 *                 type: string
 *                 example: "resto_123"
 *               rating:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 5
 *                 example: 5
 *               isFeedbackNegative:
 *                 type: boolean
 *                 example: false
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-25T12:00:00.000Z"
 *               restoinfo:
 *                 type: object
 *                 properties:
 *                   googleReviewUrl:
 *                     type: string
 *                     example: "https://g.page/r/restaurant-a/review"
 *                   googlePlaceId:
 *                     type: string
 *                   googleSyncEnabled:
 *                     type: boolean
 *                     example: true
 *               simulateMode:
 *                 type: string
 *                 enum: [NONE, FORCE_SYNCED, FORCE_POLICY_BLOCK, FORCE_TIMEOUT, FORCE_RATE_LIMIT, FORCE_PERMANENT_FAILURE]
 *                 example: "FORCE_SYNCED"
 *     responses:
 *       200:
 *         description: Sync attempt result
 *       400:
 *         description: Validation error
 */
router.get('/list', handleList);
router.post('/sync', validateRequest(syncRequestSchema), handleSync);

/**
 * @swagger
 * /integrations/google-reviews/status/{feedbackId}:
 *   get:
 *     summary: Get sync status for a feedback event
 *     description: Returns the current sync status, attempt count, reason code, and fallback info.
 *     tags: [Google Reviews Sync]
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         example: "fb_001"
 *     responses:
 *       200:
 *         description: Sync status record
 *       404:
 *         description: No record found for this feedbackId
 */
router.get('/status/:feedbackId', handleGetStatus);

/**
 * @swagger
 * /integrations/google-reviews/retry/{feedbackId}:
 *   post:
 *     summary: Manually retry a failed sync attempt
 *     description: >
 *       Only retries FAILED_RETRYABLE records under the max attempt limit (3).
 *       Use `force: true` to override the retry limit check.
 *     tags: [Google Reviews Sync]
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         example: "fb_005"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestedBy:
 *                 type: string
 *                 example: "admin_user"
 *               force:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Retry result
 *       404:
 *         description: No record found for this feedbackId
 */
router.post('/retry/:feedbackId', handleRetry);

export default router;
