export interface SyncRequest {
  feedbackId: string;
  restaurantId: string;
  rating: number;
  isFeedbackNegative: boolean;
  timestamp: string;
  restoinfo?: {
    googleSyncEnabled?: boolean;
    googleReviewUrl?: string;
    googlePlaceId?: string;
  };
  simulateMode?: SimulateMode;
}

export interface SyncResponse {
  feedbackId: string;
  restaurantId: string;
  provider: string;
  status: SyncStatus;
  attemptCount: number;
  lastAttemptAt: string;
  reasonCode: string;
  fallback?: {
    promptUrl?: string;
    promptIssued: boolean;
    promptIssuedAt?: string;
  };
  duplicate?: boolean;
}

export interface SyncListResponse {
  total: number;
  records: SyncResponse[];
}

export interface RetryResponse {
  feedbackId: string;
  retryAccepted: boolean;
  message: string;
}

export type SyncStatus =
  | 'SYNCED'
  | 'BLOCKED_BY_PROVIDER_POLICY'
  | 'FAILED_RETRYABLE'
  | 'FAILED_PERMANENT'
  | 'SKIPPED_NOT_ELIGIBLE';

export type SimulateMode =
  | 'NONE'
  | 'FORCE_SYNCED'
  | 'FORCE_POLICY_BLOCK'
  | 'FORCE_TIMEOUT'
  | 'FORCE_RATE_LIMIT'
  | 'FORCE_PERMANENT_FAILURE';
