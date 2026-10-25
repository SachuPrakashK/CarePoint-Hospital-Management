import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
export interface ApiAppointment {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  departmentId: string;
  department: string;
  doctorId: string;
  doctor: string;
  appointmentAt: string;
  status: string;
  type: string;
  consultationType: string;
  reason: string;
  fee: number;
  createdAt: string;
  updatedAt: string;
}
export interface AppointmentOptions {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
  departments: { id: string; name: string }[];
  doctors: { id: string; firstName: string; lastName: string; departmentId: string | null }[];
}
export interface AppointmentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  doctorId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
export interface AppointmentPage {
  data: ApiAppointment[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}
@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private http = inject(HttpClient);
  list(query: AppointmentQuery = {}) {
    let params = new HttpParams();
    const values: Record<string, string | number | undefined> = {
      page: query.page,
      page_size: query.pageSize,
      search: query.search,
      department_id: query.departmentId,
      doctor_id: query.doctorId,
      status: query.status,
      start_date: query.startDate,
      end_date: query.endDate,
      sort_by: query.sortBy,
      sort_order: query.sortOrder,
    };
    for (const [key, value] of Object.entries(values))
      if (value !== undefined && value !== '') params = params.set(key, value);
    return this.http.get<AppointmentPage>('/api/v1/appointments', { params });
  }
  get(id: string) {
    return this.http.get<{ data: ApiAppointment }>(`/api/v1/appointments/${id}`);
  }
  options() {
    return this.http.get<{ data: AppointmentOptions }>('/api/v1/appointments/options');
  }
  create(value: any) {
    return this.http.post<{ data: ApiAppointment }>('/api/v1/appointments', value);
  }
  update(id: string, value: any) {
    return this.http.put<{ data: ApiAppointment }>(`/api/v1/appointments/${id}`, value);
  }
  status(id: string, status: string) {
    return this.http.patch<{ data: ApiAppointment }>(`/api/v1/appointments/${id}/status`, {
      status,
    });
  }
}
