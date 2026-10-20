import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DashboardApiService } from './dashboard-api.service';
import { DashboardInvalidationService } from '../../core/services/dashboard-invalidation.service';
import {
  AppointmentStatusDatum,
  DashboardSummary,
  DepartmentAppointments,
  PatientTrend,
  RecentAppointment,
} from './dashboard.models';
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(DashboardApiService);
  private readonly invalidation = inject(DashboardInvalidationService);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly patientTrends = signal<PatientTrend[]>([]);
  readonly departmentAppointments = signal<DepartmentAppointments[]>([]);
  readonly appointmentStatuses = signal<AppointmentStatusDatum[]>([]);
  readonly recentAppointments = signal<RecentAppointment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly operationalWorkload = computed(() => {
    const value = this.summary();
    return value
      ? [
          { label: 'Admissions', count: value.current_admissions },
          { label: 'Laboratory', count: value.pending_laboratory },
          { label: 'Radiology', count: value.pending_radiology },
          { label: 'Low stock', count: value.low_stock_items },
          { label: 'Claims', count: value.open_insurance_claims },
        ]
      : [];
  });
  readonly hasOperationalWorkload = computed(() =>
    this.operationalWorkload().some((item) => item.count > 0),
  );
  readonly hasDepartmentAppointments = computed(() =>
    this.departmentAppointments().some((item) => item.count > 0),
  );
  readonly hasAppointmentStatuses = computed(() =>
    this.appointmentStatuses().some((item) => item.count > 0),
  );
  readonly stats = computed(() => {
    const v = this.summary();
    return v
      ? [
          {
            label: 'Total Patients',
            value: v.total_patients,
            note: 'Registered patients',
            variant: 'blue',
            icon: 'patients',
          },
          {
            label: "Today's Appointments",
            value: v.appointments_today,
            note: 'Scheduled today',
            variant: 'purple',
            icon: 'calendar',
          },
          {
            label: 'Current Admissions',
            value: v.current_admissions,
            note: 'Inpatient census',
            variant: 'green',
            icon: 'bed',
          },
          {
            label: 'Available Beds',
            value: v.available_beds,
            note: 'Live capacity',
            variant: 'teal',
            icon: 'bed',
          },
          {
            label: 'Pending Laboratory',
            value: v.pending_laboratory,
            note: 'Active lab workflow',
            variant: 'cyan',
            icon: 'lab',
          },
          {
            label: 'Pending Radiology',
            value: v.pending_radiology,
            note: 'Active imaging workflow',
            variant: 'violet',
            icon: 'radiology',
          },
          {
            label: 'Low Stock Items',
            value: v.low_stock_items,
            note: 'At or below reorder level',
            variant: 'coral',
            icon: 'inventory',
          },
          {
            label: 'Revenue Received',
            value: `₹${v.revenue_received}`,
            note: 'Recorded payments',
            variant: 'amber',
            icon: 'billing',
          },
          {
            label: 'Open Claims',
            value: v.open_insurance_claims,
            note: 'Insurance action required',
            variant: 'rose',
            icon: 'insurance',
          },
          {
            label: 'Available Ambulances',
            value: v.available_ambulances,
            note: 'Fleet ready',
            variant: 'indigo',
            icon: 'ambulance',
          },
        ]
      : [];
  });
  constructor() {
    this.invalidation.changed.subscribe((domains) =>
      domains.has('appointment') ? this.refreshAppointments() : this.refreshSummary(),
    );
  }
  private refreshSummary() {
    this.api
      .summary()
      .subscribe({
        next: (r) => this.summary.set(r.data),
        error: () => this.error.set('Dashboard summary could not be refreshed.'),
      });
  }
  refreshAppointments() {
    forkJoin({
      summary: this.api.summary(),
      departments: this.api.appointmentsByDepartment(),
      statuses: this.api.appointmentStatus(),
      recent: this.api.recentAppointments(),
    }).subscribe({
      next: ({ summary, departments, statuses, recent }) => {
        this.summary.set(summary.data);
        this.departmentAppointments.set(departments.data);
        this.appointmentStatuses.set(statuses.data);
        this.recentAppointments.set(recent.data);
      },
      error: () => this.error.set('Appointment dashboard data could not be refreshed.'),
    });
  }
  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.api.summary(),
      trends: this.api.patientTrends(),
      departments: this.api.appointmentsByDepartment(),
      statuses: this.api.appointmentStatus(),
      recent: this.api.recentAppointments(),
    }).subscribe({
      next: ({ summary, trends, departments, statuses, recent }) => {
        this.summary.set(summary.data);
        this.patientTrends.set(trends.data);
        this.departmentAppointments.set(departments.data);
        this.appointmentStatuses.set(statuses.data);
        this.recentAppointments.set(recent.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Dashboard data could not be loaded.');
        this.loading.set(false);
      },
    });
  }
}
