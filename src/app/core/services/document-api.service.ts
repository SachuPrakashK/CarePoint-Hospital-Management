import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ManagedDocument } from '../../shared/models/operations.models';
type ApiDoc = {
  id: string;
  ownerType: string;
  ownerId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedById: string;
  uploadedByName?: string;
  sensitive: boolean;
};
const map = (x: ApiDoc): ManagedDocument => ({
  id: x.id,
  ownerType: x.ownerType,
  ownerId: x.ownerId,
  name: x.originalName,
  mimeType: x.mimeType,
  size: x.size,
  uploadedAt: x.createdAt,
  uploadedBy: x.uploadedByName ?? x.uploadedById,
  sensitive: x.sensitive,
});
@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private http = inject(HttpClient);
  list(query: {
    page: number;
    pageSize: number;
    search?: string;
    ownerType?: string;
    mimeType?: string;
    sortBy?:string;
    sortOrder?:'asc'|'desc';
  }) {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.ownerType) params = params.set('owner_type', query.ownerType);
    if (query.mimeType) params = params.set('mime_type', query.mimeType);
    if(query.sortBy)params=params.set('sort_by',query.sortBy);
    if(query.sortOrder)params=params.set('sort_order',query.sortOrder);
    return this.http.get<{
      data: ApiDoc[];
      pagination: { page: number; page_size: number; total: number; total_pages: number };
    }>('/api/v1/documents', { params });
  }
  upload(file: File, ownerType: string, ownerId: string, sensitive: boolean) {
    const data = new FormData();
    data.append('file', file);
    data.append('ownerType', ownerType);
    data.append('ownerId', ownerId);
    data.append('sensitive', String(sensitive));
    return this.http.post<{ data: ApiDoc }>('/api/v1/documents', data);
  }
  forPatient(id: string) {
    return this.http.get<{ data: ApiDoc[] }>(`/api/v1/patients/${id}/documents`);
  }
  remove(id: string) {
    return this.http.delete<void>(`/api/v1/documents/${id}`);
  }
  download(id: string) {
    return this.http.get(`/api/v1/documents/${id}/download`, { responseType: 'blob' });
  }
  preview(id: string) {
    return this.http.get(`/api/v1/documents/${id}/view`, { responseType: 'blob' });
  }
  normalize = map;
}
