import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
export type MasterType =
  'departments' | 'specializations' | 'radiology-investigations' | 'laboratory-tests';
@Injectable({ providedIn: 'root' })
export class MasterApiService {
  private http = inject(HttpClient);
  list(
    type: MasterType,
    search = '',
    status = '',
    page = 1,
    pageSize = 10,
    category = '',
    sortBy = '',
    sortOrder: 'asc' | 'desc' | '' = '',
  ) {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (category) params = params.set('category', category);
    if (sortBy) params = params.set('sort_by', sortBy);
    if (sortOrder) params = params.set('sort_order', sortOrder);
    return this.http.get<any>(`/api/v1/masters/${type}`, { params });
  }
  create(type: MasterType, v: any) {
    return this.http.post<any>(`/api/v1/masters/${type}`, v);
  }
  update(type: MasterType, id: string, v: any) {
    return this.http.put<any>(`/api/v1/masters/${type}/${id}`, v);
  }
  deactivate(type: MasterType, id: string) {
    return this.http.delete<any>(`/api/v1/masters/${type}/${id}`);
  }
}
