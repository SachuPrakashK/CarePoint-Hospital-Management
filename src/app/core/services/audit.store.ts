import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AuditActor {
  id: string;
  name: string;
  email: string | null;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  userId: string | null;
  actor: string;
  actorEmail: string | null;
  module: string;
  action: string;
  entityId: string | null;
  entityType: string;
  metadata: unknown;
  ipAddress: string | null;
}

export interface AuditOptions {
  modules: string[];
  actions: string[];
  entityTypes: string[];
  actors: AuditActor[];
}

type AuditApiRecord = {
  id: string;
  createdAt: string;
  userId: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  user: { firstName: string; lastName: string; email: string } | null;
};

const mapAudit = (record: AuditApiRecord): AuditEvent => ({
  id: record.id,
  createdAt: record.createdAt,
  userId: record.userId,
  actor: record.user
    ? `${record.user.firstName} ${record.user.lastName}`.trim()
    : record.userId
      ? `Unavailable user (${record.userId})`
      : 'System',
  actorEmail: record.user?.email ?? null,
  module: record.module,
  action: record.action,
  entityId: record.entityId,
  entityType: record.entityType,
  metadata: record.metadata,
  ipAddress: record.ipAddress,
});

@Injectable({ providedIn: 'root' })
export class AuditStore {
  private readonly http = inject(HttpClient);
  readonly events = signal<AuditEvent[]>([]);
  readonly options = signal<AuditOptions>({
    modules: [],
    actions: [],
    entityTypes: [],
    actors: [],
  });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly totalPages = signal(0);

  async load(
    query: {
      search?: string;
      module?: string;
      action?: string;
      userId?: string;
      entityType?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    this.loading.set(true);
    this.error.set('');
    try {
      let params = new HttpParams()
        .set('page', query.page ?? 1)
        .set('page_size', query.pageSize ?? 10);
      for (const [key, value] of Object.entries({
        search: query.search,
        module: query.module,
        action: query.action,
        user_id: query.userId,
        entity_type: query.entityType,
        created_from: query.from,
        created_to: query.to,
        sort_by: query.sortBy,
        sort_order: query.sortOrder,
      }))
        if (value) params = params.set(key, value);
      const response = await firstValueFrom(
        this.http.get<{
          data: AuditApiRecord[];
          pagination: { total: number; total_pages: number };
        }>('/api/v1/audit', { params }),
      );
      this.events.set(response.data.map(mapAudit));
      this.total.set(response.pagination.total);
      this.totalPages.set(response.pagination.total_pages);
    } catch {
      this.error.set('Audit events could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadOptions() {
    const response = await firstValueFrom(
      this.http.get<{ data: AuditOptions }>('/api/v1/audit/options'),
    );
    this.options.set(response.data);
  }

  async get(id: string): Promise<AuditEvent> {
    const response = await firstValueFrom(
      this.http.get<{ data: AuditApiRecord }>(`/api/v1/audit/${encodeURIComponent(id)}`),
    );
    return mapAudit(response.data);
  }
}
