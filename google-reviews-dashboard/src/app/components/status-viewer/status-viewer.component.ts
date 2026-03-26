import { Component, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GoogleReviewsService } from '../../services/google-reviews.service';
import { SyncResponse } from '../../models/sync.models';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-status-viewer',
  standalone: true,
  imports: [DatePipe, FormsModule, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './status-viewer.component.html',
  styleUrls: ['./status-viewer.component.css'],
})
export class StatusViewerComponent {
  feedbackId = '';
  loading = false;
  result: SyncResponse | null = null;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly reviewsService = inject(GoogleReviewsService);

  onSearch(): void {
    if (!this.feedbackId.trim()) {
      return;
    }

    this.loading = true;
    this.result = null;
    this.error = null;

    this.reviewsService
      .getStatus(this.feedbackId.trim())
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
              : (err.error?.error || 'Failed to fetch status');
          this.loading = false;
        },
      });
  }
}
