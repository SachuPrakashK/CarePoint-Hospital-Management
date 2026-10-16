import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { InpatientApiService } from '../../../core/services/inpatient-api.service';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

type DetailTab = 'admission' | 'clinical' | 'nursing' | 'beds' | 'medications' | 'investigations';
type TabState = { loading: boolean; loaded: boolean; error: string };
const state = (): TabState => ({ loading: false, loaded: false, error: '' });

@Component({
  imports: [FormsModule, StatusBadge, EmptyState],
  templateUrl: './admission-details.html',
  styleUrl: './admission-details.scss',
})
export class AdmissionDetails {
  readonly id = input('');
  readonly store = inject(InpatientStore);
  private api = inject(InpatientApiService);
  private router = inject(Router);
  private dates = inject(AppDateTimeService);
  readonly admission = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly activeTab = signal<DetailTab>('admission');
  readonly clinical = signal<any[]>([]);
  readonly nursing = signal<any>({ notes: [], carePlans: [], intakeOutputs: [] });
  readonly bedHistory = signal<any[]>([]);
  readonly medications = signal<any[]>([]);
  readonly laboratory = signal<any[]>([]);
  readonly radiology = signal<any[]>([]);
  readonly tabStates = signal<Record<Exclude<DetailTab, 'admission'>, TabState>>({
    clinical: state(),
    nursing: state(),
    beds: state(),
    medications: state(),
    investigations: state(),
  });
  targetBed = '';
  finalDiagnosis = '';
  treatmentSummary = '';
  condition = 'Stable';
  instructions = '';
  followUp = '';
  readonly message = signal('');
  readonly actionSubmitting = signal(false);
  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.loadAdmission(id);
    });
  }
  async loadAdmission(id = this.id()) {
    this.loading.set(true);
    this.error.set('');
    try {
      this.admission.set(await this.store.loadAdmission(id));
    } catch {
      this.error.set('Admission details could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  format(value?: string | null) {
    return value ? this.dates.formatDateTime(value) : 'Not available';
  }
  display(value: unknown) {
    return value === null || value === undefined || value === '' ? 'Not available' : String(value);
  }
  activeAllocation() {
    const item = this.admission();
    return (
      item?.allocations?.find((allocation: any) => !allocation.endedAt) ?? item?.allocations?.at(-1)
    );
  }
  tabState(tab: DetailTab) {
    return tab === 'admission' ? state() : this.tabStates()[tab];
  }
  private setTabState(tab: Exclude<DetailTab, 'admission'>, changes: Partial<TabState>) {
    this.tabStates.update((states) => ({ ...states, [tab]: { ...states[tab], ...changes } }));
  }
  async selectTab(tab: DetailTab) {
    this.activeTab.set(tab);
    if (tab !== 'admission' && !this.tabState(tab).loaded && !this.tabState(tab).loading)
      await this.loadTab(tab);
  }
  async loadTab(tab: DetailTab) {
    if (tab === 'admission') return;
    this.setTabState(tab, { loading: true, error: '' });
    try {
      if (tab === 'clinical')
        this.clinical.set((await firstValueFrom(this.api.clinicalRecords(this.id()))).data);
      if (tab === 'nursing')
        this.nursing.set((await firstValueFrom(this.api.admissionNursing(this.id()))).data);
      if (tab === 'beds')
        this.bedHistory.set((await firstValueFrom(this.api.bedHistory(this.id()))).data);
      if (tab === 'medications')
        this.medications.set((await firstValueFrom(this.api.admissionMedications(this.id()))).data);
      if (tab === 'investigations') {
        const [labs, radiology] = await Promise.allSettled([
          firstValueFrom(this.api.admissionLaboratory(this.id())),
          firstValueFrom(this.api.admissionRadiology(this.id())),
        ]);
        if (labs.status === 'fulfilled') this.laboratory.set(labs.value.data);
        if (radiology.status === 'fulfilled') this.radiology.set(radiology.value.data);
        if (labs.status === 'rejected' && radiology.status === 'rejected')
          throw new Error('Forbidden');
      }
      this.setTabState(tab, { loaded: true });
    } catch {
      this.setTabState(tab, {
        error: `Unable to load ${tab === 'beds' ? 'bed history' : tab} records.`,
      });
    } finally {
      this.setTabState(tab, { loading: false });
    }
  }
  async transfer() {
    if (!this.targetBed || this.actionSubmitting()) return;
    this.actionSubmitting.set(true);
    try {
      await this.store.transfer(this.id(), this.targetBed);
      this.targetBed = '';
      await this.loadAdmission();
      this.setTabState('beds', state());
      if (this.activeTab() === 'beds') await this.loadTab('beds');
      this.message.set('Transfer recorded.');
    } catch (error: any) {
      this.message.set(error?.error?.message ?? error?.message ?? 'Transfer failed.');
    } finally {
      this.actionSubmitting.set(false);
    }
  }
  async discharge() {
    const admission = this.admission();
    if (!admission || !this.finalDiagnosis.trim() || this.actionSubmitting()) return;
    this.actionSubmitting.set(true);
    try {
      await this.store.discharge(admission.id, {
        finalDiagnosis: this.finalDiagnosis,
        treatmentSummary: this.treatmentSummary,
        procedures: '',
        investigationSummary: '',
        conditionAtDischarge: this.condition,
        medications: '',
        instructions: this.instructions,
        followUp: this.followUp,
        attendingDoctor: admission.attendingDoctor,
      });
      void this.router.navigateByUrl('/inpatient');
    } catch (error: any) {
      this.message.set(error?.error?.message ?? error?.message ?? 'Discharge failed.');
    } finally {
      this.actionSubmitting.set(false);
    }
  }
}
