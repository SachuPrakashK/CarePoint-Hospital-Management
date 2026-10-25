import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PatientStore } from '../patient.store';
import { PatientDetailStore, PatientTab } from '../patient-detail.store';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppDateTimePipe, AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppointmentForm } from '../../appointments/pages/appointment-form';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type DetailsTab = 'overview' | PatientTab;

@Component({
  imports: [EmptyState, AppDateTimePipe, AppointmentForm, AppIcon, AppModal, StatusBadge],
  providers: [PatientDetailStore],
  templateUrl: './patient-details.html',
  styleUrl: './patient-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDetails {
  readonly id = input.required<string>();
  readonly store = inject(PatientStore);
  readonly detail = inject(PatientDetailStore);
  readonly dates = inject(AppDateTimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly tabs: ReadonlyArray<{ id: DetailsTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'visits', label: 'Visits' },
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'documents', label: 'Documents' },
    { id: 'medical-records', label: 'Medical Records' },
    { id: 'laboratory', label: 'Laboratory' },
    { id: 'radiology', label: 'Radiology' },
    { id: 'billing', label: 'Billing' },
    { id: 'insurance', label: 'Insurance' },
  ];
  readonly activeTab = signal<DetailsTab>(
    this.validTab(this.route.snapshot.queryParamMap.get('tab')),
  );
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly appointmentOpen = signal(false);
  readonly rows = computed<any[]>(() => {
    const tab = this.activeTab();
    return tab === 'overview' || tab === 'medical-records' ? [] : (this.detail.data()[tab] ?? []);
  });
  readonly medical = computed<Record<string, any[]>>(
    () => this.detail.data()['medical-records'] ?? {},
  );
  readonly hasMedicalRecords = computed(() =>
    Object.values(this.medical()).some((items) => items.length),
  );
  readonly activeError = computed(() => {
    const tab = this.activeTab();
    return tab === 'overview' ? undefined : this.detail.errors()[tab];
  });
  private readonly patientLoader = effect(() => {
    void this.store.loadDetails(this.id());
  });
  private readonly queryTabLoader = effect(() => {
    const tab = this.validTab(this.queryParams().get('tab'));
    if (tab !== this.activeTab()) this.activeTab.set(tab);
  });
  private readonly tabLoader = effect(() => {
    const id = this.id();
    const tab = this.activeTab();
    if (tab !== 'overview') void this.detail.load(id, tab);
  });
  selectTab(tab: DetailsTab) {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'overview' ? {} : { tab },
      replaceUrl: true,
    });
  }
  retry() {
    const tab = this.activeTab();
    if (tab !== 'overview') void this.detail.load(this.id(), tab, true);
  }
  age(dob: string) {
    return this.dates.calculateAge(dob);
  }
  async appointmentCreated() {
    this.detail.invalidate('appointments');
    await this.detail.load(this.id(), 'appointments', true);
    this.appointmentOpen.set(false);
    void this.router.navigate(['/appointments']);
  }
  private validTab(value: string | null): DetailsTab {
    return this.tabs.some((tab) => tab.id === value) ? (value as DetailsTab) : 'overview';
  }
}
