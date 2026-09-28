import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DashboardApiService } from './dashboard-api.service';
import { AppointmentStatusDatum, DashboardSummary, DepartmentAppointments, PatientTrend, RecentAppointment } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(DashboardApiService);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly patientTrends = signal<PatientTrend[]>([]);
  readonly departmentAppointments = signal<DepartmentAppointments[]>([]);
  readonly appointmentStatuses = signal<AppointmentStatusDatum[]>([]);
  readonly recentAppointments = signal<RecentAppointment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = computed(() => {
    const value = this.summary();
    return value ? [
      { label: 'Total patients', value: value.total_patients, note: 'Registered patients' },
      { label: "Today's appointments", value: value.appointments_today, note: 'Scheduled today' },
      { label: 'Current admissions', value: value.current_admissions, note: 'Inpatient census' },
      { label: 'Available beds', value: value.available_beds, note: 'Live capacity' },
    ] : [];
  });
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(null);
    forkJoin({ summary: this.api.summary(), trends: this.api.patientTrends(), departments: this.api.appointmentsByDepartment(), statuses: this.api.appointmentStatus(), recent: this.api.recentAppointments() }).subscribe({
      next: ({ summary, trends, departments, statuses, recent }) => {
        this.summary.set(summary.data); this.patientTrends.set(trends.data); this.departmentAppointments.set(departments.data);
        this.appointmentStatuses.set(statuses.data); this.recentAppointments.set(recent.data); this.loading.set(false);
      },
      error: () => { this.error.set('Dashboard data could not be loaded.'); this.loading.set(false); },
    });
  }
}

