import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { InpatientApiService } from '../../../core/services/inpatient-api.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';
import { TimelineEvent } from '../../../shared/models/inpatient.models';
import { DashboardInvalidationService } from '../../../core/services/dashboard-invalidation.service';
import { AppCalendar } from '../../../shared/components/calendar/app-calendar';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
@Component({ imports: [RouterLink, EmptyState, StatusBadge, DisplayValuePipe, AppCalendar, SharedFilter], templateUrl: './emr-page.html', styleUrl: './emr-page.scss' })
export class EmrPage {
  id = input('');
  readonly clinical = inject(ClinicalStore);
  readonly inpatient = inject(InpatientStore);
  private readonly dates = inject(AppDateTimeService);
  private readonly inpatientApi = inject(InpatientApiService);
  private readonly invalidation = inject(DashboardInvalidationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tab = signal('summary');
  readonly filter = signal('');
  readonly selectedDate = signal('');
  readonly timelineItems = signal<TimelineEvent[]>([]);
  readonly timelineLoading = signal(false);
  readonly timelineError = signal('');
  readonly summary = signal<any | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal('');
  readonly detailsNotFound = signal(false);
  readonly eventTypes = [
    'Admission',
    'Consultation',
    'Diagnosis',
    'Lab Result',
    'Radiology Order',
    'Procedure',
    'Medication',
    'Discharge',
  ];
  readonly patient = computed(
    () => this.summary() ?? this.clinical.patients().find((p) => p.id === this.id()),
  );
  readonly consultations = computed(() =>
    this.clinical
      .consultations()
      .filter(
        (c) =>
          this.clinical.appointments().find((a) => a.id === c.appointmentId)?.patientId ===
          this.patient()?.id,
      ),
  );
  readonly admissions = computed(() =>
    this.inpatient.admissions().filter((a) => a.patientId === this.patient()?.id),
  );
  readonly labs = computed(() =>
    this.inpatient.labOrders().filter((o) => o.patientId === this.patient()?.id),
  );
  readonly radiology = computed(() =>
    this.inpatient.radiologyOrders().filter((o) => o.patientId === this.patient()?.id),
  );
  readonly procedures = computed(() =>
    this.inpatient.procedures().filter((o) => o.patientId === this.patient()?.id),
  );
  readonly medications = computed(() =>
    this.inpatient.medications().filter((o) => o.patientId === this.patient()?.id),
  );
  constructor() {
    effect(() => {
      const patientId = this.id();
      if (patientId) untracked(() => { void this.loadTimeline(patientId); void this.loadSummary(patientId); });
    });
    this.invalidation.changed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((domains) => {
        if (domains.has('laboratory')) void this.loadTimeline();
      });
  }
  async loadSummary(patientId = this.patient()?.id) {
    if (!patientId || this.summaryLoading()) return;
    this.summaryLoading.set(true); this.summaryError.set(''); this.detailsNotFound.set(false); this.summary.set(null);
    try { this.summary.set((await firstValueFrom(this.inpatientApi.clinicalSummary(patientId))).data); }
    catch (error: any) {
      if (error?.status === 404) this.detailsNotFound.set(true);
      else this.summaryError.set('Unable to load the clinical record.');
    }
    finally { this.summaryLoading.set(false); }
  }
  histories(type: string) { return this.summary()?.histories?.filter((item: any) => item.type === type) ?? []; }
  async loadTimeline(patientId = this.patient()?.id) {
    if (!patientId || this.timelineLoading()) return;
    this.timelineLoading.set(true);
    this.timelineError.set('');
    try {
      const date = this.selectedDate();
      const response = await firstValueFrom(
        this.inpatientApi.timeline(patientId, {
          type: this.filter() || undefined,
          from: date || undefined,
          to: date || undefined,
        }),
      );
      this.timelineItems.set(
        response.data.map((item) => ({ ...item, patientId, actor: item.actor ?? 'System' })),
      );
    } catch {
      this.timelineError.set('Clinical timeline could not be loaded.');
    } finally {
      this.timelineLoading.set(false);
    }
  }
  applyTimelineFilters() {
    void this.loadTimeline();
  }
  clearTimelineFilters() {
    this.filter.set('');
    this.selectedDate.set('');
    void this.loadTimeline();
  }
  shiftDate(days: number) {
    const base = this.selectedDate() || this.dates.today();
    const [year, month, day] = base.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    this.selectedDate.set(next.toISOString().slice(0, 10));
    void this.loadTimeline();
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
}
