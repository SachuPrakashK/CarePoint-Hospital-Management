import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
type Page<T> = {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
};
@Injectable({ providedIn: 'root' })
export class Phase23ApiService {
  private http = inject(HttpClient);
  private params(query: Record<string, unknown> = {}) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(query)) if (v !== '' && v != null) p = p.set(k, String(v));
    return p;
  }
  inventory(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/inventory/items', { params: this.params(q) });
  }
  inventoryItem(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/inventory/items/${id}`);
  }
  inventoryOptions() {
    return Promise.all([]);
  }
  createInventory(v: any) {
    return this.http.post<{ data: any }>('/api/v1/inventory/items', v);
  }
  updateInventory(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/inventory/items/${id}`, v);
  }
  removeInventory(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/inventory/items/${id}`);
  }
  moveStock(id: string, v: any) {
    return this.http.post<{ data: any }>(`/api/v1/inventory/items/${id}/movements`, v);
  }
  categories() {
    return this.http.get<{ data: any[] }>('/api/v1/inventory/categories');
  }
  suppliers(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/inventory/suppliers', { params: this.params(q) });
  }
  supplier(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/inventory/suppliers/${id}`);
  }
  createSupplier(v: any) {
    return this.http.post<{ data: any }>('/api/v1/inventory/suppliers', v);
  }
  updateSupplier(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/inventory/suppliers/${id}`, v);
  }
  removeSupplier(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/inventory/suppliers/${id}`);
  }
  ambulances(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/ambulances', { params: this.params(q) });
  }
  ambulance(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/ambulances/${id}`);
  }
  createAmbulance(v: any) {
    return this.http.post<{ data: any }>('/api/v1/ambulances', v);
  }
  updateAmbulance(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/ambulances/${id}`, v);
  }
  removeAmbulance(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/ambulances/${id}`);
  }
  ambulanceBookings(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/ambulance-bookings', { params: this.params(q) });
  }
  bookAmbulance(v: any) {
    return this.http.post<{ data: any }>('/api/v1/ambulance-bookings', v);
  }
  assignAmbulance(id: string, ambulanceId: string) {
    return this.http.patch<{ data: any }>(`/api/v1/ambulance-bookings/${id}/assign`, {
      ambulanceId,
    });
  }
  invoices(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/billing', { params: this.params(q) });
  }
  invoice(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/billing/${id}`);
  }
  createInvoice(v: any, idempotencyKey: string) {
    return this.http.post<{ data: any }>('/api/v1/billing', v, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  updateInvoice(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/billing/${id}`, v);
  }
  cancelInvoice(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/billing/${id}`);
  }
  pay(id: string, v: any, idempotencyKey: string) {
    return this.http.post<{ data: any }>(`/api/v1/billing/${id}/payments`, v, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  refunds(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/billing/refunds', { params: this.params(q) });
  }
  payments(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/billing-payments', { params: this.params(q) });
  }
  requestRefund(paymentId: string, v: any, idempotencyKey: string) {
    return this.http.post<{ data: any }>(`/api/v1/billing/payments/${paymentId}/refunds`, v, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  resolveRefund(id: string, status: 'Approved' | 'Rejected') {
    return this.http.patch<{ data: any }>(`/api/v1/billing/refunds/${id}`, { status });
  }
  providers(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/insurance/providers', { params: this.params(q) });
  }
  insuranceSummary() {
    return this.http.get<{ data: any }>('/api/v1/insurance/summary');
  }
  insuranceProvider(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/insurance/providers/${id}`);
  }
  createProvider(v: any) {
    return this.http.post<{ data: any }>('/api/v1/insurance/providers', v);
  }
  updateProvider(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/insurance/providers/${id}`, v);
  }
  deactivateProvider(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/insurance/providers/${id}`);
  }
  removeProvider(id: string) {
    return this.deactivateProvider(id);
  }
  policies(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/insurance/policies', { params: this.params(q) });
  }
  insurancePolicy(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/insurance/policies/${id}`);
  }
  createPolicy(v: any) {
    return this.http.post<{ data: any }>('/api/v1/insurance/policies', v);
  }
  updatePolicy(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/insurance/policies/${id}`, v);
  }
  deactivatePolicy(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/insurance/policies/${id}`);
  }
  claims(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/insurance/claims', { params: this.params(q) });
  }
  insuranceClaim(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/insurance/claims/${id}`);
  }
  createClaim(v: any) {
    return this.http.post<{ data: any }>('/api/v1/insurance/claims', v);
  }
  updateClaim(id: string, v: any) {
    return this.http.patch<{ data: any }>(`/api/v1/insurance/claims/${id}`, v);
  }
  labOrders(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/laboratory/orders', { params: this.params(q) });
  }
  labOrder(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/laboratory/orders/${id}`);
  }
  createLab(v: any) {
    return this.http.post<{ data: any }>('/api/v1/laboratory/orders', v);
  }
  updateLab(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/laboratory/orders/${id}`, v);
  }
  labStatus(id: string, v: any) {
    return this.http.patch<{ data: any }>(`/api/v1/laboratory/orders/${id}/status`, v);
  }
  labResult(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/laboratory/orders/${id}/result`, v);
  }
  radiologyOrders(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/radiology/orders', { params: this.params(q) });
  }
  radiologyOrder(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/radiology/orders/${id}`);
  }
  createRadiology(v: any) {
    return this.http.post<{ data: any }>('/api/v1/radiology/orders', v);
  }
  updateRadiology(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/radiology/orders/${id}`, v);
  }
  cancelRadiology(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/radiology/orders/${id}`);
  }
  purchaseOrders(q: Record<string, unknown> = {}) {
    return this.http.get<Page<any>>('/api/v1/procurement/orders', { params: this.params(q) });
  }
  purchaseOrder(id: string) {
    return this.http.get<{ data: any }>(`/api/v1/procurement/orders/${id}`);
  }
  createPurchaseOrder(v: any) {
    return this.http.post<{ data: any }>('/api/v1/procurement/orders', v);
  }
  updatePurchaseOrder(id: string, v: any) {
    return this.http.put<{ data: any }>(`/api/v1/procurement/orders/${id}`, v);
  }
  cancelPurchaseOrder(id: string) {
    return this.http.delete<{ data: any }>(`/api/v1/procurement/orders/${id}`);
  }
  receivePurchaseOrder(id: string, v: any) {
    return this.http.post<{ data: any }>(`/api/v1/procurement/orders/${id}/receive`, v);
  }
}
