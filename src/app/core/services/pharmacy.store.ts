import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PharmacyApiService } from './pharmacy-api.service';
import { DashboardInvalidationService } from './dashboard-invalidation.service';

export interface PharmacyQuery { page: number; pageSize: number; search?: string; category?: string; lowStock?: boolean; expiry?: string; sortBy?:string; sortOrder?:'asc'|'desc'; }

@Injectable({ providedIn: 'root' })
export class PharmacyStore {
  private api = inject(PharmacyApiService);
  private dashboard = inject(DashboardInvalidationService);
  private stockRequest = 0;
  readonly loading = signal(false); readonly error = signal('');
  readonly medicines = signal<any[]>([]); readonly batches = signal<any[]>([]); readonly dispenses = signal<any[]>([]);
  readonly stockLedger = signal<any[]>([]); readonly stockBatches = signal<any[]>([]);
  readonly stockLoading = signal(false); readonly stockError = signal('');
  readonly stockTotal = signal(0); readonly stockTotalPages = signal(0); readonly stockBaseTotal = signal(0);
  readonly categories = signal<string[]>([]); readonly expirySoonDays = signal(90);
  readonly stockStats = signal({ lowStock: 0, expiring: 0 });
  readonly ledgerLoading = signal(false); readonly ledgerError = signal(''); readonly ledgerTotal = signal(0);
  readonly lowStock = computed(() => this.medicines().filter((medicine) => this.medicineQuantity(medicine.id) <= Math.max(0, ...this.batches().filter((batch) => batch.medicineId === medicine.id).map((batch) => batch.reorderLevel))));
  readonly expiring = computed(() => { const limit = Date.now() + this.expirySoonDays() * 86_400_000; return this.batches().filter((batch) => new Date(batch.expiresAt).getTime() >= Date.now() && new Date(batch.expiresAt).getTime() <= limit); });
  readonly lowStockCount = computed(() => this.stockStats().lowStock); readonly expiringCount = computed(() => this.stockStats().expiring);

  constructor() { void this.load(); }
  private normalizeBatch(item: any) { return { ...item, purchasePrice: Number(item.purchasePrice), sellingPrice: Number(item.sellingPrice) }; }

  async load() {
    this.loading.set(true); this.error.set('');
    try {
      const [medicines, batches, dispenses] = await Promise.all([
        firstValueFrom(this.api.medicines({ page_size: 100 })), firstValueFrom(this.api.batches({ page_size: 100 })), firstValueFrom(this.api.dispenses({ page_size: 100 })),
      ]);
      this.medicines.set(medicines.data); this.batches.set(batches.data.map((item) => this.normalizeBatch(item)));
      this.stockBatches.set(batches.data.slice(0, 10).map((item) => this.normalizeBatch(item))); this.stockTotal.set(batches.pagination.total); this.stockTotalPages.set(Math.ceil(batches.pagination.total / 10));
      if (batches.meta) { this.stockBaseTotal.set(batches.meta.base_total); this.categories.set(batches.meta.categories); this.expirySoonDays.set(batches.meta.expiry_soon_days); this.stockStats.set({ lowStock: batches.meta.low_stock_total, expiring: batches.meta.expiring_total }); }
      this.dispenses.set(dispenses.data.map((item) => ({ ...item, patientName: `${item.patient?.firstName ?? ''} ${item.patient?.lastName ?? ''}`.trim(), items: (item.items ?? []).map((entry: any) => ({ ...entry, prescribedQuantity: Number(entry.prescribedQuantity), dispensedQuantity: Number(entry.dispensedQuantity), unitPrice: Number(entry.unitPrice) })) })));
      await this.loadLedger();
    } catch { this.error.set('Pharmacy data could not be loaded.'); }
    finally { this.loading.set(false); }
  }

  async loadStock(query: PharmacyQuery) {
    const request = ++this.stockRequest; this.stockLoading.set(true); this.stockError.set('');
    try {
      const response = await firstValueFrom(this.api.batches({ page: query.page, page_size: query.pageSize, search: query.search, category: query.category, low_stock: query.lowStock ? 'true' : '', expiry: query.expiry,sort_by:query.sortBy,sort_order:query.sortOrder }));
      if (request !== this.stockRequest) return;
      this.stockBatches.set(response.data.map((item) => this.normalizeBatch(item))); this.stockTotal.set(response.pagination.total); this.stockTotalPages.set(response.pagination.total_pages);
      if (response.meta) { this.stockBaseTotal.set(response.meta.base_total); this.categories.set(response.meta.categories); this.expirySoonDays.set(response.meta.expiry_soon_days); this.stockStats.set({ lowStock: response.meta.low_stock_total, expiring: response.meta.expiring_total }); }
    } catch { if (request === this.stockRequest) { this.stockBatches.set([]); this.stockError.set('Medicine stock could not be loaded.'); } }
    finally { if (request === this.stockRequest) this.stockLoading.set(false); }
  }

  async loadLedger() {
    this.ledgerLoading.set(true); this.ledgerError.set('');
    try { const response = await firstValueFrom(this.api.ledger({ page_size: 100 })); this.stockLedger.set(response.data); this.ledgerTotal.set(response.pagination.total); }
    catch { this.stockLedger.set([]); this.ledgerError.set('Stock ledger could not be loaded.'); }
    finally { this.ledgerLoading.set(false); }
  }

  batchQuantity(id: string) { return Number(this.batches().find((batch) => batch.id === id)?.quantity ?? this.stockBatches().find((batch) => batch.id === id)?.quantity ?? 0); }
  medicineQuantity(id: string) { return this.batches().filter((batch) => batch.medicineId === id).reduce((sum, batch) => sum + Number(batch.quantity), 0); }
  async dispense(id: string, items: any[]) { const request = this.dispenses().find((item) => item.id === id); const selected = items.map((item) => ({ itemId: request.items.find((entry: any) => entry.medicineId === item.medicineId && entry.batchId === item.batchId)?.id, quantity: item.dispensedQuantity })); const response = await firstValueFrom(this.api.complete(id, selected)); await this.load(); this.dashboard.invalidate('pharmacy', 'inventory', 'billing'); return response.data.invoice; }
  async saveMedicine(mode: 'create' | 'edit', value: any, id?: string) { if (mode === 'create') await firstValueFrom(this.api.createMedicine(value)); else await firstValueFrom(this.api.updateMedicine(id!, value)); await this.load(); this.dashboard.invalidate('pharmacy'); }
  async saveBatch(value: any, id?: string) { await firstValueFrom(id ? this.api.updateBatch(id, value) : this.api.createBatch(value)); await this.load(); this.dashboard.invalidate('pharmacy', 'inventory'); }
  async deactivate(id: string) { await firstValueFrom(this.api.deactivateMedicine(id)); await this.load(); this.dashboard.invalidate('pharmacy'); }
}
