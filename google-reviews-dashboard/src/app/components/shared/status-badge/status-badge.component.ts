import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { SyncStatus } from '../../../models/sync.models';

/**
 * Displays a colored badge for a given sync status.
 *
 * Usage:
 *   <app-status-badge [status]="record.status" />
 *   <app-status-badge [status]="record.status" [showIcon]="true" />
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [NgClass],
  styleUrls: ['./status-badge.component.css'],
  template: `
    <span class="badge" [ngClass]="cssClass">
      @if (showIcon()) {
        <span class="badge-icon">{{ icon }}</span>
      }
      {{ displayLabel }}
    </span>
  `,
})
export class StatusBadgeComponent {
  /** The sync status to display. */
  readonly status = input.required<SyncStatus>();

  /** Whether to render the status icon alongside the label. */
  readonly showIcon = input<boolean>(false);

  private static readonly CLASS_MAP: Record<SyncStatus, string> = {
    SYNCED: 'badge-success',
    BLOCKED_BY_PROVIDER_POLICY: 'badge-warning',
    FAILED_RETRYABLE: 'badge-info',
    FAILED_PERMANENT: 'badge-danger',
    SKIPPED_NOT_ELIGIBLE: 'badge-muted',
  };

  private static readonly ICON_MAP: Record<SyncStatus, string> = {
    SYNCED: '\u2713',
    BLOCKED_BY_PROVIDER_POLICY: '\u26A0',
    FAILED_RETRYABLE: '\u21BB',
    FAILED_PERMANENT: '\u2717',
    SKIPPED_NOT_ELIGIBLE: '\u2014',
  };

  get cssClass(): string {
    return StatusBadgeComponent.CLASS_MAP[this.status()] ?? '';
  }

  get icon(): string {
    return StatusBadgeComponent.ICON_MAP[this.status()] ?? '?';
  }

  get displayLabel(): string {
    return this.status().replace(/_/g, ' ');
  }
}
