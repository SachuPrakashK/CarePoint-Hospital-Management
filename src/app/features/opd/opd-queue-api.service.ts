import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
export interface OpdQueueItem {
  id: string;
  appointmentId: string;
  appointmentNumber: string;
  appointmentStatus: string;
  appointmentAt: string;
  patientId: string;
  patientName: string;
  mrn: string;
  departmentId: string;
  department: string;
  doctorId: string;
  doctor: string;
  token: string;
  tokenNumber: number;
  status: string;
  checkedInAt: string;
  calledAt?: string;
  consultationAt?: string;
  completedAt?: string;
}
@Injectable({ providedIn: 'root' })
export class OpdQueueApiService {
  private readonly http = inject(HttpClient);
  list(query: {
    page: number;
    pageSize: number;
    search?: string;
    departmentId?: string;
    doctorId?: string;
    status?: string;
    date?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    const values = {
      search: query.search,
      department_id: query.departmentId,
      doctor_id: query.doctorId,
      status: query.status,
      date: query.date,
      sort_by: query.sortBy,
      sort_order: query.sortOrder,
    };
    for (const [key, value] of Object.entries(values)) if (value) params = params.set(key, value);
    return this.http.get<{
      data: OpdQueueItem[];
      pagination: { page: number; page_size: number; total: number; total_pages: number };
    }>('/api/v1/opd-queue', { params });
  }
  status(id: string, status: string) {
    return this.http.patch<{ data: OpdQueueItem }>(`/api/v1/opd-queue/${id}/status`, { status });
  }
}
