import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { SyncRequest, SyncResponse, SyncListResponse, RetryResponse } from '../models/sync.models';
import { environment } from '../../environments/environment';

/**
 * Service for interacting with the Google Reviews sync API.
 *
 * Handles all HTTP communication for syncing feedback to Google Reviews,
 * checking sync status, retrying failed syncs, and listing sync history.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleReviewsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/integrations/google-reviews`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Submits a feedback record for synchronization with Google Reviews.
   *
   * @param request - The sync payload containing feedback details and configuration.
   * @returns An observable that emits the sync result once the server responds.
   */
  sync(request: SyncRequest): Observable<SyncResponse> {
    return this.http.post<SyncResponse>(`${this.baseUrl}/sync`, request);
  }

  /**
   * Retrieves the current sync status for a given feedback record.
   *
   * @param feedbackId - The unique identifier of the feedback to look up.
   * @returns An observable that emits the sync record for the given ID.
   */
  getStatus(feedbackId: string): Observable<SyncResponse> {
    return this.http.get<SyncResponse>(`${this.baseUrl}/status/${feedbackId}`);
  }

  /**
   * Retries a previously failed sync attempt.
   *
   * @param feedbackId - The unique identifier of the feedback to retry.
   * @param force - When `true`, retries even if the failure is marked as permanent.
   * @returns An observable that emits the retry acceptance result.
   */
  retry(feedbackId: string, force = false): Observable<RetryResponse> {
    return this.http.post<RetryResponse>(`${this.baseUrl}/retry/${feedbackId}`, { force });
  }

  /**
   * Fetches all sync records from the server.
   *
   * @returns An observable containing the total count and the list of sync records.
   */
  listAll(): Observable<SyncListResponse> {
    return this.http.get<SyncListResponse>(`${this.baseUrl}/list`);
  }
}
