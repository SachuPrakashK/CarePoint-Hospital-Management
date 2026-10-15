import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class AuditStore {
  private http = inject(HttpClient);
  readonly events = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly totalPages = signal(0);
  async load(
    q: {
      search?: string;
      module?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    this.loading.set(true);
    try {
      let params = new HttpParams().set('page', q.page ?? 1).set('page_size', q.pageSize ?? 10);
      for (const [key, value] of Object.entries({
        search: q.search,
        module: q.module,
        action: q.action,
        created_from: q.from,
        created_to: q.to,
        sort_by: q.sortBy,
        sort_order: q.sortOrder,
      }))
        if (value) params = params.set(key, value);
      const r = await firstValueFrom(this.http.get<any>('/api/v1/audit', { params }));
      this.events.set(
        r.data.map((x: any) => ({
          id: x.id,
          at: x.createdAt,
          actor: x.user ? `${x.user.firstName} ${x.user.lastName}` : 'System',
          module: x.module,
          action: x.action,
          entityId: x.entityId ?? '',
          entityType: x.entityType,
          detail: x.metadata ? JSON.stringify(x.metadata) : x.entityType,
          ipAddress: x.ipAddress ?? '',
        })),
      );
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set('Audit events could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
