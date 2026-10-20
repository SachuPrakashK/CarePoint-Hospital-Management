import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { ToastService } from '../../core/services/toast.service';
import { ChartEmptyState } from '../../shared/components/chart-empty-state/chart-empty-state';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { SharedExport } from '../../shared/components/export/shared-export';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { SummaryCard, SummaryCardVariant } from '../../shared/components/summary-card/summary-card';
import { AppointmentStatusChart } from '../dashboard/components/appointment-status-chart/appointment-status-chart';
import { AppointmentsDepartmentChart } from '../dashboard/components/appointments-department-chart/appointments-department-chart';
import { CHART_COLORS } from '../dashboard/components/chart-colors';
import { ReportsApiService, ReportsData } from './reports-api.service';
@Component({
  imports: [
    SharedFilter,
    SharedExport,
    SummaryCard,
    AppointmentStatusChart,
    AppointmentsDepartmentChart,
    ChartEmptyState,
    AppPagination,
  ],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly api = inject(ReportsApiService);
  private readonly dates = inject(AppDateTimeService);
  private readonly toast = inject(ToastService);
  readonly Math = Math;
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly data = signal<ReportsData | null>(null);
  readonly from = signal(this.dates.dateKey(new Date(Date.now() - 29 * 86400000)));
  readonly to = signal(this.dates.today());
  readonly departmentId = signal('');
  readonly appliedFilters = signal({
    from: this.from(),
    to: this.to(),
    departmentId: '',
  });
  readonly category = signal('overview');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly dateInvalid = computed(() => this.from() > this.to());
  readonly activeFilterCount = computed(
    () => 2 + (this.departmentId() ? 1 : 0) + (this.category() !== 'overview' ? 1 : 0),
  );
  readonly visibleRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.data()?.department_performance.slice(start, start + this.pageSize()) ?? [];
  });
  readonly cards = computed(() => {
    const value = this.data()?.summary;
    if (!value) return [];
    const cards: {
      title: string;
      value: string | number;
      note: string;
      icon: string;
      variant: SummaryCardVariant;
      category: string;
    }[] = [
      {
        title: 'Total Patients',
        value: value.total_patients,
        note: 'Registered in selected period',
        icon: 'patients',
        variant: 'blue',
        category: 'clinical',
      },
      {
        title: 'Total Appointments',
        value: value.total_appointments,
        note: 'Scheduled in selected period',
        icon: 'calendar',
        variant: 'purple',
        category: 'clinical',
      },
      {
        title: 'OPD Visits',
        value: value.opd_visits,
        note: 'Checked-in visits',
        icon: 'queue',
        variant: 'cyan',
        category: 'clinical',
      },
      {
        title: 'Active Admissions',
        value: value.active_admissions,
        note: 'Admitted in selected period',
        icon: 'bed',
        variant: 'green',
        category: 'operations',
      },
      {
        title: 'Bed Occupancy',
        value: `${value.bed_occupancy_rate}%`,
        note: 'Current occupied capacity',
        icon: 'bed',
        variant: 'teal',
        category: 'operations',
      },
      {
        title: 'Completed Procedures',
        value: value.completed_procedures,
        note: 'Completed in selected period',
        icon: 'procedures',
        variant: 'violet',
        category: 'clinical',
      },
    ];
    if (value.total_revenue != null)
      cards.push({
        title: 'Total Revenue',
        value: this.currency(value.total_revenue),
        note: 'Payments net of recorded refunds',
        icon: 'billing',
        variant: 'amber',
        category: 'finance',
      });
    if (value.outstanding_payments != null)
      cards.push({
        title: 'Outstanding Payments',
        value: this.currency(value.outstanding_payments),
        note: 'Unpaid invoiced balance',
        icon: 'documents',
        variant: 'coral',
        category: 'finance',
      });
    return this.category() === 'overview'
      ? cards
      : cards.filter((card) => card.category === this.category());
  });
  constructor() {
    void this.load();
  }
  async load() {
    if (this.dateInvalid()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const filters = {
        from: this.from(),
        to: this.to(),
        departmentId: this.departmentId(),
      };
      this.data.set((await firstValueFrom(this.api.overview(filters))).data);
      this.appliedFilters.set(filters);
    } catch {
      this.error.set('Reports data could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  apply() {
    this.page.set(1);
    void this.load();
  }
  clear() {
    this.from.set(this.dates.dateKey(new Date(Date.now() - 29 * 86400000)));
    this.to.set(this.dates.today());
    this.departmentId.set('');
    this.category.set('overview');
    this.apply();
  }
  go(value: number) {
    this.page.set(value);
  }
  resize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
  }
  departmentColor(index: number) {
    return `#${CHART_COLORS[index % CHART_COLORS.length].toString(16).padStart(6, '0')}`;
  }
  async exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const blob = await firstValueFrom(this.api.exportCsv(this.appliedFilters()));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `medicare-report-${this.appliedFilters().to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('The report could not be exported. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }
  currency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
