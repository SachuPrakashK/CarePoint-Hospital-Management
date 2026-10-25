import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
export type PharmacyPage<T> = {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
  meta?: {
    base_total: number;
    low_stock_total: number;
    expiring_total: number;
    categories: string[];
    expiry_soon_days: number;
  };
};
@Injectable({ providedIn: 'root' })
export class PharmacyApiService {
  private http = inject(HttpClient);
  private params(q: Record<string, unknown> = {}) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v !== '' && v != null) p = p.set(k, String(v));
    return p;
  }
  medicines(q: Record<string, unknown> = {}) {
    return this.http.get<PharmacyPage<any>>('/api/v1/pharmacy/medicines', {
      params: this.params(q),
    });
  }
  createMedicine(v: any) {
    return this.http.post<{ data: any }>('/api/v1/pharmacy/medicines', v);
  }
  updateMedicine(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/pharmacy/medicines/${id}`, v);
  }
  deactivateMedicine(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/pharmacy/medicines/${id}`);
  }
  batches(q: Record<string, unknown> = {}) {
    return this.http.get<PharmacyPage<any>>('/api/v1/pharmacy/batches', { params: this.params(q) });
  }
  createBatch(v: any) {
    return this.http.post<{ data: any }>('/api/v1/pharmacy/batches', v);
  }
  updateBatch(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/pharmacy/batches/${id}`, v);
  }
  dispenses(q: Record<string, unknown> = {}) {
    return this.http.get<PharmacyPage<any>>('/api/v1/pharmacy/dispenses', {
      params: this.params(q),
    });
  }
  createDispense(v: any) {
    return this.http.post<{ data: any }>('/api/v1/pharmacy/dispenses', v);
  }
  complete(id: string, items: any[]) {
    return this.http.post<{ data: any }>(`/api/v1/pharmacy/dispenses/${id}/complete`, { items });
  }
  ledger(q: Record<string, unknown> = {}) {
    return this.http.get<PharmacyPage<any>>('/api/v1/pharmacy/stock-movements', {
      params: this.params(q),
    });
  }
}
