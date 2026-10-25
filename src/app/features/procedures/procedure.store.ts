import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardInvalidationService } from '../../core/services/dashboard-invalidation.service';
import { ProcedureApiService, ProcedureQuery } from './procedure-api.service';

@Injectable({ providedIn: 'root' })
export class ProcedureStore {
  private api = inject(ProcedureApiService);
  private dashboard = inject(DashboardInvalidationService);
  private request = 0;
  readonly records = signal<any[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly stats = signal({
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    availableTheatres: 0,
  });
  readonly lookups = signal<any>({ theatres: [], doctors: [], admissions: [], statuses: [] });

  async initialize(query: ProcedureQuery) {
    await Promise.all([this.load(query), this.loadStats(), this.loadLookups()]);
  }
  async load(query: ProcedureQuery) {
    const current = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.api.list(query));
      if (current !== this.request) return;
      this.records.set(response.data.map(this.map));
      this.total.set(response.pagination.total);
      this.totalPages.set(response.pagination.total_pages);
    } catch {
      if (current === this.request) this.error.set('Procedures could not be loaded.');
    } finally {
      if (current === this.request) this.loading.set(false);
    }
  }
  async loadStats() {
    this.stats.set((await firstValueFrom(this.api.stats())).data);
  }
  async loadLookups() {
    this.lookups.set((await firstValueFrom(this.api.lookups())).data);
  }
  async details(id: string) {
    return this.map((await firstValueFrom(this.api.details(id))).data);
  }
  async save(value: any, id?: string) {
    const response = id
      ? await firstValueFrom(this.api.update(id, value))
      : await firstValueFrom(this.api.create(value));
    await this.loadStats();
    this.dashboard.invalidate('operations');
    return this.map(response.data);
  }
  async transition(id: string, status: string) {
    return this.save({ status }, id);
  }
  private map = (item: any) => ({
    ...item,
    patientName: `${item.patient?.firstName ?? ''} ${item.patient?.lastName ?? ''}`.trim(),
    mrn: item.patient?.mrn ?? '',
    doctorName: `${item.doctor?.firstName ?? ''} ${item.doctor?.lastName ?? ''}`.trim(),
    theatreName: item.theatre?.name ?? '',
  });
}
