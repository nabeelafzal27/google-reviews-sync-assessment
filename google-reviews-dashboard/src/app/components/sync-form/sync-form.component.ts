import { Component, DestroyRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GoogleReviewsService } from '../../services/google-reviews.service';
import { SyncRequest, SyncResponse, SimulateMode } from '../../models/sync.models';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';

interface SimulateModeOption {
  value: SimulateMode;
  label: string;
}

@Component({
  selector: 'app-sync-form',
  standalone: true,
  imports: [NgClass, FormsModule, LoadingSpinnerComponent],
  templateUrl: './sync-form.component.html',
  styleUrls: ['./sync-form.component.css'],
})
export class SyncFormComponent {
  @Output() synced = new EventEmitter<SyncResponse>();
  @ViewChild('syncForm') syncForm!: NgForm;

  feedbackId = '';
  restaurantId = '';
  rating = 5;
  isFeedbackNegative = false;
  googleSyncEnabled = true;
  googleReviewUrl = 'https://g.page/r/restaurant-a/review';
  simulateMode: SimulateMode = 'FORCE_SYNCED';

  loading = false;
  result: SyncResponse | null = null;
  error: string | null = null;

  readonly simulateModes: readonly SimulateModeOption[] = [
    { value: 'NONE', label: 'None (default)' },
    { value: 'FORCE_SYNCED', label: 'Force Synced' },
    { value: 'FORCE_POLICY_BLOCK', label: 'Force Policy Block' },
    { value: 'FORCE_TIMEOUT', label: 'Force Timeout' },
    { value: 'FORCE_RATE_LIMIT', label: 'Force Rate Limit' },
    { value: 'FORCE_PERMANENT_FAILURE', label: 'Force Permanent Failure' },
  ] as const;

  private readonly destroyRef = inject(DestroyRef);
  private readonly reviewsService = inject(GoogleReviewsService);

  onSubmit(): void {
    this.loading = true;
    this.result = null;
    this.error = null;

    const request: SyncRequest = {
      feedbackId: this.feedbackId,
      restaurantId: this.restaurantId,
      rating: this.rating,
      isFeedbackNegative: this.isFeedbackNegative,
      timestamp: new Date().toISOString(),
      restoinfo: {
        googleSyncEnabled: this.googleSyncEnabled,
        googleReviewUrl: this.googleReviewUrl,
      },
      simulateMode: this.simulateMode,
    };

    this.reviewsService
      .sync(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
          this.synced.emit(res);
          this.resetForm();
        },
        error: (err) => {
          this.error = err.error?.error || err.message || 'Sync failed';
          this.loading = false;
        },
      });
  }

  private resetForm(): void {
    const defaults = {
      feedbackId: '',
      restaurantId: '',
      rating: 5,
      isFeedbackNegative: false,
      googleSyncEnabled: true,
      googleReviewUrl: 'https://g.page/r/restaurant-a/review',
      simulateMode: 'FORCE_SYNCED' as SimulateMode,
    };

    Object.assign(this, defaults);

    // Use requestAnimationFrame to defer the form control reset until
    // after Angular finishes the current change detection cycle.
    requestAnimationFrame(() => this.syncForm?.resetForm(defaults));
  }
}
