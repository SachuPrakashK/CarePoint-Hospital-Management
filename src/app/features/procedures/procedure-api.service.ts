import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface ProcedureQuery {
  page: number;
  pageSize: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  theatreId?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
@Injectable({ providedIn: 'root' })
export class ProcedureApiService {
  private http = inject(HttpClient);
  list(query: ProcedureQuery) {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    for (const [key, value] of Object.entries({
      search: query.search,
      from_date: query.fromDate,
      to_date: query.toDate,
      theatre_id: query.theatreId,
      status: query.status,
      sort_by: query.sortBy,
      sort_order: query.sortOrder,
    }))
      if (value) params = params.set(key, value);
    return this.http.get<{ data: any[]; pagination: any }>('/api/v1/procedures', { params });
  }
  details(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/procedures/${id}`);
  }
  stats() {
    return this.http.get<{ data: any }>('/api/v1/procedures/stats');
  }
  lookups() {
    return this.http.get<{ data: any }>('/api/v1/procedure-lookups');
  }
  create(value: any) {
    return this.http.post<{ data: any }>('/api/v1/procedures', value);
  }
  update(id: string, value: any) {
    return this.http.put<{ data: any }>(`/api/v1/procedures/${id}`, value);
  }
}
