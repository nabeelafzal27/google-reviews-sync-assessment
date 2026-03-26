import { Component, signal } from '@angular/core';
import { SyncFormComponent } from '../sync-form/sync-form.component';
import { StatusViewerComponent } from '../status-viewer/status-viewer.component';
import { RetryPanelComponent } from '../retry-panel/retry-panel.component';
import { ReviewsListComponent } from '../reviews-list/reviews-list.component';

type TabId = 'sync' | 'status' | 'retry';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    SyncFormComponent,
    StatusViewerComponent,
    RetryPanelComponent,
    ReviewsListComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  activeTab: TabId = 'sync';

  /**
   * Monotonically increasing counter that signals the reviews list to reload.
   * Each increment triggers a fresh fetch in the child component.
   */
  readonly refreshTick = signal(0);

  onSynced(): void {
    this.refreshTick.update((n) => n + 1);
  }
}
