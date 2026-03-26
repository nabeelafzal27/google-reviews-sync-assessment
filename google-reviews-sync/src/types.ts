// --- Enums ---

export enum SyncStatus {
  SYNCED = 'SYNCED',
  BLOCKED_BY_PROVIDER_POLICY = 'BLOCKED_BY_PROVIDER_POLICY',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_PERMANENT = 'FAILED_PERMANENT',
  SKIPPED_NOT_ELIGIBLE = 'SKIPPED_NOT_ELIGIBLE',
}

export enum ReasonCode {
  ELIGIBLE_AND_SYNCED = 'ELIGIBLE_AND_SYNCED',
  CREATE_REVIEW_NOT_SUPPORTED = 'CREATE_REVIEW_NOT_SUPPORTED',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_BAD_REQUEST = 'PROVIDER_BAD_REQUEST',
  AUTH_INVALID = 'AUTH_INVALID',
  NOT_ELIGIBLE_LOW_RATING = 'NOT_ELIGIBLE_LOW_RATING',
  NOT_ELIGIBLE_NEGATIVE_FEEDBACK = 'NOT_ELIGIBLE_NEGATIVE_FEEDBACK',
  NOT_ELIGIBLE_GOOGLE_DISABLED = 'NOT_ELIGIBLE_GOOGLE_DISABLED',
  DUPLICATE_EVENT_IGNORED = 'DUPLICATE_EVENT_IGNORED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum SimulateMode {
  NONE = 'NONE',
  FORCE_SYNCED = 'FORCE_SYNCED',
  FORCE_POLICY_BLOCK = 'FORCE_POLICY_BLOCK',
  FORCE_TIMEOUT = 'FORCE_TIMEOUT',
  FORCE_RATE_LIMIT = 'FORCE_RATE_LIMIT',
  FORCE_PERMANENT_FAILURE = 'FORCE_PERMANENT_FAILURE',
}

/**
 * Terminal statuses where no further processing should occur.
 * Once a record reaches one of these states, duplicate events are ignored.
 */
export const TERMINAL_STATUSES = new Set<SyncStatus>([
  SyncStatus.SYNCED,
  SyncStatus.BLOCKED_BY_PROVIDER_POLICY,
  SyncStatus.FAILED_PERMANENT,
  SyncStatus.SKIPPED_NOT_ELIGIBLE,
] as const);

/** Provider identifier used throughout the system. */
export const PROVIDER_NAME = 'google_reviews' as const;

// --- Request / Response Interfaces ---

export interface RestoInfo {
  readonly id?: string;
  readonly name?: string;
  readonly email?: string;
  readonly sendFeedbacktoAdmin?: boolean;
  readonly googleReviewUrl?: string;
  readonly googlePlaceId?: string;
  readonly googleSyncEnabled?: boolean;
}

export interface SyncRequest {
  readonly feedbackId: string;
  readonly restaurantId: string;
  readonly rating: number;
  readonly isFeedbackNegative: boolean;
  readonly timestamp: string;
  readonly restoinfo?: RestoInfo;
  readonly simulateMode?: SimulateMode;
  // Allow additional fields from the original feedback event
  readonly [key: string]: unknown;
}

export interface SyncResponse {
  readonly feedbackId: string;
  readonly restaurantId: string;
  readonly provider: typeof PROVIDER_NAME;
  readonly status: SyncStatus;
  readonly attemptCount: number;
  readonly lastAttemptAt: string;
  readonly reasonCode: ReasonCode;
  readonly fallback?: FallbackInfo;
  readonly duplicate?: boolean;
}

export interface FallbackInfo {
  readonly promptUrl?: string;
  readonly promptIssued: boolean;
  readonly promptIssuedAt?: string;
}

export interface LastError {
  readonly code: string;
  readonly message: string;
  readonly isRetryable: boolean;
}

export interface IdempotencyInfo {
  readonly key: string;
  readonly firstProcessedAt: string;
  readonly duplicateCount: number;
}

// --- Provider Result (Discriminated Union) ---

/**
 * Provider interface for review sync adapters.
 * Implementations must convert a SyncRequest into a ProviderResult
 * that captures success or a typed failure with retryability info.
 */
export interface GoogleReviewsProvider {
  /** Attempt to sync the feedback to the external review platform. */
  attemptSync(request: SyncRequest): Promise<ProviderResult>;
}

interface ProviderSuccess {
  readonly success: true;
}

interface ProviderFailure {
  readonly success: false;
  readonly error: LastError;
}

export type ProviderResult = ProviderSuccess | ProviderFailure;

// --- Database Record ---

export interface SyncStatusRecord {
  readonly feedbackId: string;
  readonly restaurantId: string;
  readonly provider: string;
  readonly status: SyncStatus;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly reasonCode: ReasonCode;
  readonly lastError: LastError | null;
  readonly fallback: FallbackInfo | null;
  readonly idempotencyKey: string;
  readonly firstProcessedAt: string;
  readonly duplicateCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// --- Eligibility Result (Discriminated Union) ---

interface Eligible {
  readonly eligible: true;
}

interface NotEligible {
  readonly eligible: false;
  readonly reasonCode: ReasonCode;
}

export type EligibilityResult = Eligible | NotEligible;

// --- Retry Request ---

export interface RetryRequest {
  readonly requestedBy?: string;
  readonly force?: boolean;
}

export interface RetryResponse {
  readonly feedbackId: string;
  readonly retryAccepted: boolean;
  readonly message: string;
}

// --- Error Taxonomy ---

/**
 * Base application error with HTTP status semantics.
 * All domain-specific errors extend this to carry structured context.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;

  constructor(statusCode: number, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.context = context;
  }
}

/** Thrown when a requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(404, `${resource} not found: ${identifier}`, { resource, identifier });
    this.name = 'NotFoundError';
  }
}

/** Thrown when request input fails validation. */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

/** Thrown when an external provider call fails. */
export class ProviderError extends AppError {
  readonly isRetryable: boolean;

  constructor(message: string, isRetryable: boolean, context?: Record<string, unknown>) {
    super(502, message, context);
    this.name = 'ProviderError';
    this.isRetryable = isRetryable;
  }
}
