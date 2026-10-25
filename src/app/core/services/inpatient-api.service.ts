import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface AdmissionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
export interface AdmissionPage {
  data: any[];
  pagination?: { page: number; page_size: number; total: number; total_pages: number };
}

@Injectable({ providedIn: 'root' })
export class InpatientApiService {
  private http = inject(HttpClient);
  private params(query: AdmissionQuery) {
    let params = new HttpParams();
    const values: Record<string, unknown> = {
      page: query.page,
      page_size: query.pageSize,
      search: query.search,
      department_id: query.departmentId,
      status: query.status,
      sort_by: query.sortBy,
      sort_order: query.sortOrder,
    };
    for (const [key, value] of Object.entries(values))
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    return params;
  }
  admissions(query: AdmissionQuery = {}) {
    return this.http.get<AdmissionPage>('/api/v1/admissions', { params: this.params(query) });
  }
  admission(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/admissions/${id}`);
  }
  clinicalRecords(id: string) {
    return this.http.get<{ data: any[] }>(`/api/v1/admissions/${id}/clinical-records`);
  }
  admissionNursing(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/admissions/${id}/nursing`);
  }
  bedHistory(id: string) {
    return this.http.get<{ data: any[] }>(`/api/v1/admissions/${id}/bed-history`);
  }
  admissionMedications(id: string) {
    return this.http.get<{ data: any[] }>(`/api/v1/admissions/${id}/medications`);
  }
  admissionLaboratory(id: string) {
    return this.http.get<{ data: any[] }>(`/api/v1/admissions/${id}/laboratory`);
  }
  admissionRadiology(id: string) {
    return this.http.get<{ data: any[] }>(`/api/v1/admissions/${id}/radiology`);
  }
  admit(v: any) {
    return this.http.post<{ data: any }>('/api/v1/admissions', v);
  }
  update(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/admissions/${id}`, v);
  }
  transfer(id: string, toBedId: string, reason = '') {
    return this.http.post<{ data: any }>(`/api/v1/admissions/${id}/transfer`, { toBedId, reason });
  }
  discharge(id: string, v: any) {
    return this.http.post<{ data: any }>(`/api/v1/admissions/${id}/discharge`, v);
  }
  wards() {
    return this.http.get<{ data: any[] }>('/api/v1/wards');
  }
  createWard(v: any) {
    return this.http.post<{ data: any }>('/api/v1/wards', v);
  }
  beds() {
    return this.http.get<{ data: any[] }>('/api/v1/beds');
  }
  availableBeds() {
    return this.http.get<{ data: any[] }>('/api/v1/beds/availability');
  }
  lookups() {
    return this.http.get<{ data: any }>('/api/v1/inpatient-lookups');
  }
  assignedPatients() {
    return this.http.get<{ data: any[] }>('/api/v1/nursing/assigned-patients');
  }
  nursingStaff() {
    return this.http.get<{ data: any[] }>('/api/v1/nursing/staff');
  }
  handovers(admissionId?: string) {
    const params = admissionId ? new HttpParams().set('admission_id', admissionId) : undefined;
    return this.http.get<{ data: any[] }>('/api/v1/nursing/handovers', { params });
  }
  createHandover(value: any) {
    return this.http.post<{ data: any }>('/api/v1/nursing/handovers', value);
  }
  acknowledgeHandover(id: string) {
    return this.http.post<{ data: any }>(`/api/v1/nursing/handovers/${id}/acknowledge`, {});
  }
  notes(admissionId?: string) {
    const params = admissionId ? new HttpParams().set('admission_id', admissionId) : undefined;
    return this.http.get<{ data: any[] }>('/api/v1/nursing-notes', { params });
  }
  addNote(v: any) {
    return this.http.post<{ data: any }>('/api/v1/nursing-notes', v);
  }
  medications(admissionId?: string) {
    const params = admissionId ? new HttpParams().set('admission_id', admissionId) : undefined;
    return this.http.get<{ data: any[] }>('/api/v1/medication-administrations', { params });
  }
  administer(id: string, v: any) {
    return this.http.patch<{ data: any }>(`/api/v1/medication-administrations/${id}`, v);
  }
  procedures() {
    return this.http.get<{ data: any[] }>('/api/v1/procedures');
  }
  createProcedure(v: any) {
    return this.http.post<{ data: any }>('/api/v1/procedures', v);
  }
  updateProcedure(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/procedures/${id}`, v);
  }
  timeline(patientId: string, query: { type?: string; from?: string; to?: string } = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value) params = params.set(key, value);
    return this.http.get<{ data: any[] }>(`/api/v1/patients/${patientId}/timeline`, { params });
  }
  clinicalSummary(patientId: string) {
    return this.http.get<{ data: any }>(`/api/v1/patients/${patientId}/clinical-summary`);
  }
}
