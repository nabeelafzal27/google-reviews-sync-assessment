import { Component, DestroyRef, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GoogleReviewsService } from '../../services/google-reviews.service';
import { RetryResponse } from '../../models/sync.models';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-retry-panel',
  standalone: true,
  imports: [NgClass, FormsModule, LoadingSpinnerComponent],
  templateUrl: './retry-panel.component.html',
  styleUrls: ['./retry-panel.component.css'],
})
export class RetryPanelComponent {
  feedbackId = '';
  force = false;
  loading = false;
  result: RetryResponse | null = null;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly reviewsService = inject(GoogleReviewsService);

  onRetry(): void {
    if (!this.feedbackId.trim()) {
      return;
    }

    this.loading = true;
    this.result = null;
    this.error = null;

    this.reviewsService
      .retry(this.feedbackId.trim(), this.force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err.status === 404
              ? `No record found for "${this.feedbackId}"`
              : (err.error?.error || 'Retry failed');
          this.loading = false;
        },
      });
  }
}
