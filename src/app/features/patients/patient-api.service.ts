import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Patient } from '../../shared/models/clinical.models';
export type PatientWrite = Omit<Patient, 'id' | 'mrn' | 'createdAt'>;
export interface PatientPage {
  data: Patient[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    all_total: number;
  };
}
type Data<T> = { data: T; message?: string };
@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private http = inject(HttpClient);
  private base = '/api/v1/patients';
  list(query: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    gender?: string;
    minAge?: number;
    maxAge?: number;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.gender) params = params.set('gender', query.gender);
    if (query.minAge != null) params = params.set('min_age', query.minAge);
    if (query.maxAge != null) params = params.set('max_age', query.maxAge);
    if (query.createdFrom) params = params.set('created_from', query.createdFrom);
    if (query.createdTo) params = params.set('created_to', query.createdTo);
    if (query.sortBy) params = params.set('sort_by', query.sortBy);
    if (query.sortOrder) params = params.set('sort_order', query.sortOrder);
    return this.http.get<PatientPage>(this.base, { params });
  }
  details(id: string) {
    return this.http.get<Data<Patient>>(`${this.base}/${id}`);
  }
  appointments(id: string) {
    return this.http.get<Data<any[]>>(`${this.base}/${id}/appointments`);
  }
  visits(id: string) {
    return this.http.get<Data<any[]>>(`${this.base}/${id}/visits`);
  }
  prescriptions(id: string) {
    return this.http.get<Data<any[]>>(`${this.base}/${id}/prescriptions`);
  }
  documents(id: string) {
    return this.http.get<Data<any[]>>(`${this.base}/${id}/documents`);
  }
  medicalRecords(id: string) {
    return this.http.get<Data<Record<string, any[]>>>(`${this.base}/${id}/medical-records`);
  }
  laboratory(id: string) {
    return this.http.get<PatientPageLike<any>>('/api/v1/laboratory/orders', {
      params: new HttpParams().set('patient_id', id).set('page_size', 100),
    });
  }
  radiology(id: string) {
    return this.http.get<PatientPageLike<any>>('/api/v1/radiology/orders', {
      params: new HttpParams().set('patient_id', id).set('page_size', 100),
    });
  }
  billing(id: string) {
    return this.http.get<PatientPageLike<any>>('/api/v1/billing', {
      params: new HttpParams().set('patient_id', id).set('page_size', 100),
    });
  }
  insurance(id: string) {
    return this.http.get<PatientPageLike<any>>('/api/v1/insurance/policies', {
      params: new HttpParams().set('patient_id', id).set('page_size', 100),
    });
  }
  create(value: PatientWrite) {
    return this.http.post<Data<Patient>>(this.base, value, {
      headers: { 'X-Handle-Error-Locally': 'true' },
    });
  }
  update(id: string, value: Partial<PatientWrite>) {
    return this.http.put<Data<Patient>>(`${this.base}/${id}`, value, {
      headers: { 'X-Handle-Error-Locally': 'true' },
    });
  }
  archive(id: string) {
    return this.http.delete<Data<Patient>>(`${this.base}/${id}`);
  }
}
interface PatientPageLike<T> {
  data: T[];
  pagination: unknown;
}
