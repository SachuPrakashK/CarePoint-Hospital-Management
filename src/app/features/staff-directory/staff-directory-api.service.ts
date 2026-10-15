import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
export type StaffKind = 'doctors' | 'employees';
export interface StaffRecord {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  departmentId: string;
  department?: { id: string; name: string };
  specializationId?: string;
  specialization?: { id: string; name: string };
  medicalRegistration?: string;
  qualification?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  designation?: string;
  joiningDate?: string;
  employmentType?: string;
  createdAt: string;
  updatedAt: string;
  roles: { role: { code: string; name: string } }[];
}
export interface StaffOptions {
  departments: { id: string; name: string }[];
  specializations: { id: string; name: string; departmentId: string }[];
  roles: { id: string; code: string; name: string }[];
}
export interface StaffInput {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string | null;
  phone: string;
  email: string;
  address?: string;
  employeeCode: string;
  departmentId: string;
  specializationId?: string | null;
  medicalRegistration?: string | null;
  qualification?: string;
  yearsOfExperience?: number | null;
  consultationFee?: number | null;
  designation?: string;
  joiningDate?: string | null;
  employmentType?: string;
  status: 'ACTIVE' | 'INACTIVE';
  roleCode?: string;
}
@Injectable({ providedIn: 'root' })
export class StaffDirectoryApiService {
  private http = inject(HttpClient);
  list(
    kind: StaffKind,
    q: {
      page: number;
      pageSize: number;
      search?: string;
      departmentId?: string;
      specializationId?: string;
      designation?: string;
      status?: string;
      sortBy?:string;sortOrder?:'asc'|'desc';
    },
  ) {
    let p = new HttpParams().set('page', q.page).set('page_size', q.pageSize);
    for (const [key, value] of Object.entries({
      search: q.search,
      department_id: q.departmentId,
      specialization_id: q.specializationId,
      designation: q.designation,
      status: q.status,
      sort_by:q.sortBy,sort_order:q.sortOrder,
    }))
      if (value) p = p.set(key, value);
    return this.http.get<{
      data: StaffRecord[];
      pagination: { page: number; page_size: number; total: number; total_pages: number };
    }>(`/api/v1/${kind}`, { params: p });
  }
  get(kind: StaffKind, id: string) {
    return this.http.get<{ data: StaffRecord }>(`/api/v1/${kind}/${id}`);
  }
  options(kind: StaffKind) {
    return this.http.get<{ data: StaffOptions }>(`/api/v1/${kind}/options`);
  }
  save(kind: StaffKind, id: string | null, value: StaffInput) {
    return id
      ? this.http.patch<{ data: StaffRecord }>(`/api/v1/${kind}/${id}`, value)
      : this.http.post<{ data: StaffRecord }>(`/api/v1/${kind}`, value);
  }
  remove(kind: StaffKind, id: string) {
    return this.http.delete(`/api/v1/${kind}/${id}`);
  }
}
