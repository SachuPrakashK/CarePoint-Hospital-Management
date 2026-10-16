import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationStore } from '../../core/notifications/notification.store';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { AppDateTimePipe } from '../../core/services/app-date-time.service';
@Component({
  imports: [EmptyState, AppPagination, AppDateTimePipe],
  templateUrl: './notifications-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  readonly store = inject(NotificationStore);
  constructor() {
    void this.store.load();
  }
}
