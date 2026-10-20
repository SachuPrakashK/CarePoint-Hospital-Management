import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
export interface ReportsData {
  filters: { departments: { id: string; name: string }[] };
  summary: {
    total_patients: number;
    total_appointments: number;
    opd_visits: number;
    active_admissions: number;
    bed_occupancy_rate: number;
    completed_procedures: number;
    total_revenue: number | null;
    outstanding_payments: number | null;
  };
  patient_trends: { date: string; count: number }[];
  appointment_statuses: { status: string; count: number }[];
  department_visits: { department: string; count: number }[];
  department_performance: {
    id: string;
    department: string;
    appointments: number;
    admissions: number;
    total_visits: number;
  }[];
  scope: { finance_visible: boolean };
}
@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private params(filters: { from: string; to: string; departmentId: string }) {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.departmentId) params = params.set('department_id', filters.departmentId);
    return params;
  }
  overview(filters: { from: string; to: string; departmentId: string }) {
    const params = this.params(filters);
    return this.http.get<{ data: ReportsData }>('/api/v1/reports/overview', { params });
  }
  exportCsv(filters: { from: string; to: string; departmentId: string }) {
    return this.http.get('/api/v1/reports/export.csv', {
      params: this.params(filters),
      headers: new HttpHeaders({ 'X-Handle-Error-Locally': 'true' }),
      responseType: 'blob',
    });
  }
}
