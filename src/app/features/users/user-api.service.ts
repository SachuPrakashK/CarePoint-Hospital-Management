import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { UserRole } from '../../core/models/auth.models';
export interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  createdAt: string;
  lastLoginAt?: string;
  roles: { role: UserRole }[];
}
export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  status: 'ACTIVE' | 'INACTIVE';
  roleCode: string;
}
@Injectable({ providedIn: 'root' })
export class UserApiService {
  private http = inject(HttpClient);
  list(
    query: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      role?: string;
      sortBy?:string;sortOrder?:'asc'|'desc';
    } = {},
  ) {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('page_size', query.pageSize ?? 10);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.role) params = params.set('role', query.role);
    if(query.sortBy)params=params.set('sort_by',query.sortBy);if(query.sortOrder)params=params.set('sort_order',query.sortOrder);
    return this.http.get<{
      data: ManagedUser[];
      pagination: { page: number; page_size: number; total: number; total_pages: number };
    }>('/api/v1/users', { params });
  }
  create(value: UserInput) {
    return this.http.post<{ data: ManagedUser }>('/api/v1/users', value);
  }
  update(id: string, value: Omit<UserInput, 'roleCode'>) {
    return this.http.put<{ data: ManagedUser }>(`/api/v1/users/${id}`, value);
  }
  role(id: string, roleCode: UserRole['code']) {
    return this.http.patch<{ data: ManagedUser }>(`/api/v1/users/${id}/role`, { roleCode });
  }
  status(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.http.patch<{ data: ManagedUser }>(`/api/v1/users/${id}/status`, { status });
  }
  remove(id: string) {
    return this.http.delete<{ data: ManagedUser }>(`/api/v1/users/${id}`);
  }
  resetPassword(id: string, password: string) {
    return this.http.patch(`/api/v1/users/${id}/reset-password`, { password });
  }
}
