import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Patient } from '../../shared/models/clinical.models';
import { PatientApiService, PatientWrite } from './patient-api.service';
import { DashboardInvalidationService } from '../../core/services/dashboard-invalidation.service';
import { TableSort } from '../../shared/models/table.models';
@Injectable({ providedIn: 'root' })
export class PatientStore {
  private api = inject(PatientApiService);
  private dashboard = inject(DashboardInvalidationService);
  readonly patients = signal<Patient[]>([]);
  readonly selected = signal<Patient | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly allTotal = signal(0);
  readonly totalPages = signal(0);
  readonly search = signal('');
  readonly status = signal('');
  readonly gender = signal('');
  readonly minAge = signal<number | null>(null);
  readonly maxAge = signal<number | null>(null);
  readonly createdFrom = signal('');
  readonly createdTo = signal('');
  readonly sort = signal<TableSort | null>(null);
  private requestVersion = 0;
  async load() {
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(
        this.api.list({
          page: this.page(),
          pageSize: this.pageSize(),
          search: this.search() || undefined,
          status: this.status() || undefined,
          gender: this.gender() || undefined,
          minAge: this.minAge() ?? undefined,
          maxAge: this.maxAge() ?? undefined,
          createdFrom: this.createdFrom() || undefined,
          createdTo: this.createdTo() || undefined,
          sortBy: this.sort()?.field,
          sortOrder: this.sort()?.direction,
        }),
      );
      if (requestVersion !== this.requestVersion) return;
      this.patients.set(r.data);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
      this.allTotal.set(r.pagination.all_total);
    } catch {
      if (requestVersion !== this.requestVersion) return;
      this.error.set('Patients could not be loaded.');
    } finally {
      if (requestVersion === this.requestVersion) this.loading.set(false);
    }
  }
  async loadDetails(id: string) {
    this.loading.set(true);
    this.error.set(null);
    this.selected.set(null);
    try {
      const r = await firstValueFrom(this.api.details(id));
      this.selected.set(r.data);
      return r.data;
    } catch {
      this.error.set('Patient details could not be loaded.');
      return null;
    } finally {
      this.loading.set(false);
    }
  }
  async create(value: PatientWrite) {
    const r = await firstValueFrom(this.api.create(value));
    await this.load();
    this.dashboard.invalidate('patient');
    return r.data;
  }
  async update(id: string, value: Partial<PatientWrite>) {
    const r = await firstValueFrom(this.api.update(id, value));
    await this.load();
    this.dashboard.invalidate('patient');
    return r.data;
  }
  async archive(id: string) {
    await firstValueFrom(this.api.archive(id));
    await this.load();
    this.dashboard.invalidate('patient');
  }
}
