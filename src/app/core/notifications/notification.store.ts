import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  readAt?: string;
}
interface Page {
  data: AppNotification[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private http = inject(HttpClient);
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pagination = signal({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  readonly latest = computed(() => this.notifications().slice(0, 6));
  async load(page = 1, pageSize = this.pagination().pageSize) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [list, count] = await Promise.all([
        firstValueFrom(
          this.http.get<Page>('/api/v1/notifications', {
            params: new HttpParams().set('page', page).set('page_size', pageSize),
          }),
        ),
        firstValueFrom(
          this.http.get<{ data: { count: number } }>('/api/v1/notifications/unread-count'),
        ),
      ]);
      this.notifications.set(list.data);
      this.unreadCount.set(count.data.count);
      this.pagination.set({
        page: list.pagination.page,
        pageSize: list.pagination.page_size,
        total: list.pagination.total,
        totalPages: list.pagination.total_pages,
      });
    } catch {
      this.error.set('Notifications could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  async changePage(page: number) {
    await this.load(page, this.pagination().pageSize);
  }
  async changePageSize(pageSize: number) {
    await this.load(1, pageSize);
  }
  async markRead(item: AppNotification) {
    if (item.isRead) return;
    const response = await firstValueFrom(
      this.http.patch<{ data: AppNotification }>(`/api/v1/notifications/${item.id}/read`, {}),
    );
    this.notifications.update((items) =>
      items.map((value) => (value.id === item.id ? response.data : value)),
    );
    this.unreadCount.update((count) => Math.max(0, count - 1));
  }
  async markAllRead() {
    await firstValueFrom(this.http.patch('/api/v1/notifications/read-all', {}));
    const now = new Date().toISOString();
    this.notifications.update((items) =>
      items.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now })),
    );
    this.unreadCount.set(0);
  }
}
