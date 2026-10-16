import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AppLanguage } from '../../core/i18n/language.service';
export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string;
}
export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isSystem: boolean;
  createdAt: string;
  _count: { users: number };
  permissions: { permission: PermissionRecord }[];
}
export interface Page<T> {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}
@Injectable({ providedIn: 'root' })
export class AdministrationApiService {
  private http = inject(HttpClient);
  roles(query: { page?: number; pageSize?: number; search?: string; status?: string; sortBy?: string; sortOrder?: 'asc'|'desc' } = {}) {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('page_size', query.pageSize ?? 10);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.sortBy) params = params.set('sort_by', query.sortBy);
    if (query.sortOrder) params = params.set('sort_order', query.sortOrder);
    return this.http.get<Page<RoleRecord>>('/api/v1/roles', { params });
  }
  permissions() {
    return this.http.get<{ data: PermissionRecord[] }>('/api/v1/permissions');
  }
  role(id: string) {
    return this.http.get<{ data: RoleRecord }>(`/api/v1/roles/${id}`);
  }
  createRole(value: any) {
    return this.http.post<{ data: RoleRecord }>('/api/v1/roles', value);
  }
  updateRole(id: string, value: any) {
    return this.http.put<{ data: RoleRecord }>(`/api/v1/roles/${id}`, value);
  }
  deleteRole(id: string) {
    return this.http.delete(`/api/v1/roles/${id}`);
  }
  setting<T>(section: string) {
    return this.http.get<{ data: T }>(`/api/v1/settings/${section}`);
  }
  saveSetting<T>(section: string, value: T) {
    return this.http.patch<{ data: T }>(`/api/v1/settings/${section}`, value);
  }
  uploadLogo(file: File) {
    const body = new FormData();
    body.append('logo', file);
    return this.http.post<{ data: { url: string } }>('/api/v1/settings/hospital/logo', body);
  }
  logo() {
    return this.http.get('/api/v1/settings/hospital/logo', { responseType: 'blob' });
  }
  deleteLogo() {
    return this.http.delete('/api/v1/settings/hospital/logo');
  }
  languages(){return this.http.get<{data:AppLanguage[]}>('/api/v1/languages/configuration');}
  setLanguageEnabled(code:string,enabled:boolean){return this.http.patch<{data:AppLanguage}>(`/api/v1/languages/${encodeURIComponent(code)}`,{enabled});}
  supportContacts(){return this.http.get<{data:any}>('/api/v1/support/contacts');}
  saveSupportContacts(value:any){return this.http.put<{data:any}>('/api/v1/support/contacts',value);}
  supportArticles(){return this.http.get<{data:any[]}>('/api/v1/support/articles/manage');}
  createSupportArticle(value:any){return this.http.post<{data:any}>('/api/v1/support/articles',value);}
  updateSupportArticle(id:string,value:any){return this.http.put<{data:any}>(`/api/v1/support/articles/${id}`,value);}
  deleteSupportArticle(id:string){return this.http.delete(`/api/v1/support/articles/${id}`);}
}
