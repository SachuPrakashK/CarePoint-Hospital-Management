import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PatientApiService } from './patient-api.service';

export type PatientTab = 'appointments' | 'visits' | 'prescriptions' | 'documents' | 'medical-records' | 'laboratory' | 'radiology' | 'billing' | 'insurance';

@Injectable()
export class PatientDetailStore {
  private readonly api = inject(PatientApiService);
  readonly data = signal<Partial<Record<PatientTab, any>>>({});
  readonly loading = signal<PatientTab | null>(null);
  readonly errors = signal<Partial<Record<PatientTab, string>>>({});
  private readonly loaded = new Set<PatientTab>();

  async load(patientId: string, tab: PatientTab, force = false) {
    if (!force && this.loaded.has(tab)) return;
    this.loading.set(tab);
    this.errors.update((errors) => ({ ...errors, [tab]: undefined }));
    try {
      const request = tab === 'appointments' ? this.api.appointments(patientId)
        : tab === 'visits' ? this.api.visits(patientId)
        : tab === 'prescriptions' ? this.api.prescriptions(patientId)
        : tab === 'documents' ? this.api.documents(patientId)
        : tab === 'laboratory' ? this.api.laboratory(patientId)
        : tab === 'radiology' ? this.api.radiology(patientId)
        : tab === 'billing' ? this.api.billing(patientId)
        : tab === 'insurance' ? this.api.insurance(patientId)
        : this.api.medicalRecords(patientId);
      const response: any = await firstValueFrom(request as any);
      this.data.update((data) => ({ ...data, [tab]: response.data }));
      this.loaded.add(tab);
    } catch {
      this.errors.update((errors) => ({ ...errors, [tab]: `Unable to load ${tab.replace('-', ' ')}.` }));
    } finally {
      if (this.loading() === tab) this.loading.set(null);
    }
  }

  invalidate(tab: PatientTab) { this.loaded.delete(tab); }
}
