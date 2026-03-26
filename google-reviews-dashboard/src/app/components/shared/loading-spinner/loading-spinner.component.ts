import { Component, input } from '@angular/core';

/**
 * A lightweight CSS-only loading spinner.
 *
 * Usage:
 *   <app-loading-spinner />
 *   <app-loading-spinner size="sm" />
 *   <app-loading-spinner size="lg" message="Fetching records..." />
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  styleUrls: ['./loading-spinner.component.css'],
  template: `
    <div class="spinner-container" [class.spinner-sm]="size() === 'sm'" [class.spinner-lg]="size() === 'lg'">
      <div class="spinner"></div>
      @if (message()) {
        <span class="spinner-message">{{ message() }}</span>
      }
    </div>
  `,
})
export class LoadingSpinnerComponent {
  /** Visual size variant: 'sm' (16px), 'md' (24px default), or 'lg' (36px). */
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  /** Optional message displayed below the spinner. */
  readonly message = input<string>('');
}
