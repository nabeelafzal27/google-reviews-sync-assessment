import { Component, DestroyRef, effect, inject, input, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GoogleReviewsService } from '../../services/google-reviews.service';
import { SyncResponse } from '../../models/sync.models';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-reviews-list',
  standalone: true,
  imports: [DatePipe, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './reviews-list.component.html',
  styleUrls: ['./reviews-list.component.css'],
})
export class ReviewsListComponent implements OnInit {
  /**
   * Incrementing counter from the parent; when it changes the list reloads.
   * The initial value (0) triggers the first load in `ngOnInit`.
   */
  readonly refreshTick = input<number>(0);

  records: SyncResponse[] = [];
  loading = false;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly reviewsService = inject(GoogleReviewsService);
  private initialized = false;

  constructor() {
    // React to subsequent refreshTick changes (skips the initial 0 from ngOnInit).
    effect(() => {
      const tick = this.refreshTick();
      if (this.initialized && tick > 0) {
        this.loadRecords();
      }
    });
  }

  ngOnInit(): void {
    this.loadRecords();
    this.initialized = true;
  }

  loadRecords(): void {
    this.loading = true;
    this.error = null;

    this.reviewsService
      .listAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.records = res.records;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.error || 'Failed to load records';
          this.loading = false;
        },
      });
  }
}
