import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DashboardSummary, PatientTrend, DepartmentAppointments, AppointmentStatusDatum, RecentAppointment } from './dashboard.models';

type ApiData<T> = { data: T };

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/dashboard';
  summary() { return this.http.get<ApiData<DashboardSummary>>(`${this.base}/summary`); }
  patientTrends() { return this.http.get<ApiData<PatientTrend[]>>(`${this.base}/patient-trends`); }
  appointmentsByDepartment() { return this.http.get<ApiData<DepartmentAppointments[]>>(`${this.base}/appointments-by-department`); }
  appointmentStatus() { return this.http.get<ApiData<AppointmentStatusDatum[]>>(`${this.base}/appointment-status`); }
  recentAppointments() { return this.http.get<ApiData<RecentAppointment[]>>(`${this.base}/recent-appointments`); }
}

