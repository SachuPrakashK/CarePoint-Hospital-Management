import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from './phase23-api.service';
import { DashboardDomain, DashboardInvalidationService } from './dashboard-invalidation.service';
@Injectable({ providedIn: 'root' })
export class Phase23Store {
  private api = inject(Phase23ApiService);
  private dashboard = inject(DashboardInvalidationService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly inventory = signal<any[]>([]);
  readonly suppliers = signal<any[]>([]);
  readonly ambulances = signal<any[]>([]);
  readonly bookings = signal<any[]>([]);
  readonly invoices = signal<any[]>([]);
  readonly payments = signal<any[]>([]);
  readonly refunds = signal<any[]>([]);
  readonly providers = signal<any[]>([]);
  readonly policies = signal<any[]>([]);
  readonly claims = signal<any[]>([]);
  readonly labOrders = signal<any[]>([]);
  readonly radiologyOrders = signal<any[]>([]);
  readonly purchaseOrders = signal<any[]>([]);
  constructor() {
    void this.loadAll();
  }
  private optional<T extends { data: any[] }>(request: Promise<T>): Promise<T> {
    return request.catch(() => ({ data: [] }) as unknown as T);
  }
  async loadAll() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [i, s, a, b, iv, rf, p, po, c, l, r, purchase] = await Promise.all([
        this.optional(firstValueFrom(this.api.inventory({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.suppliers())),
        this.optional(firstValueFrom(this.api.ambulances({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.ambulanceBookings({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.invoices({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.refunds({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.providers({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.policies({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.claims({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.labOrders({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.radiologyOrders({ page_size: 100 }))),
        this.optional(firstValueFrom(this.api.purchaseOrders({ page_size: 100 }))),
      ]);
      this.inventory.set(
        i.data.map((x) => ({
          ...x,
          openingQuantity: x.quantity,
          category: x.category?.name,
          supplierId: x.supplierId,
        })),
      );
      this.suppliers.set(s.data.map((x) => ({ ...x, status: x.isActive ? 'Active' : 'Inactive' })));
      this.ambulances.set(a.data);
      this.bookings.set(b.data);
      this.invoices.set(iv.data.map(this.mapInvoice));
      this.payments.set(iv.data.flatMap((x) => x.payments ?? []));
      this.refunds.set(rf.data);
      this.providers.set(p.data.map((x) => ({ ...x, status: x.isActive ? 'Active' : 'Inactive' })));
      this.policies.set(po.data);
      this.claims.set(c.data);
      this.labOrders.set(
        l.data.map((x) => ({
          ...x,
          patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
        })),
      );
      this.radiologyOrders.set(
        r.data.map((x) => ({
          ...x,
          patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
        })),
      );
      this.purchaseOrders.set(
        purchase.data.map((x) => ({
          ...x,
          itemId: x.medicineId ?? x.inventoryItemId,
          unitPrice: Number(x.unitPrice),
        })),
      );
    } catch {
      this.error.set('Phase 2-3 data could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  private mapInvoice = (x: any) => ({
    ...x,
    patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
    insuranceAmount: 0,
    items: (x.items ?? []).map((i: any) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: 0,
      taxRate: 0,
    })),
  });
  totals(invoiceId: string) {
    const i = this.invoices().find((x) => x.id === invoiceId);
    const subtotal = (i?.items ?? []).reduce(
      (s: number, x: any) => s + Number(x.quantity) * Number(x.unitPrice),
      0,
    );
    const paid = this.payments()
      .filter((x) => x.invoiceId === invoiceId)
      .reduce((sum, payment) => {
        const refunded = this.refunds()
          .filter((refund) => refund.paymentId === payment.id && refund.status === 'Approved')
          .reduce((value, refund) => value + Number(refund.amount), 0);
        return sum + Number(payment.amount) - refunded;
      }, 0);
    return { subtotal, discount: 0, tax: 0, total: subtotal, paid, balance: subtotal - paid };
  }
  paid(invoiceId: string) {
    return this.totals(invoiceId).paid;
  }
  balance(invoiceId: string) {
    return this.totals(invoiceId).balance;
  }
  outstanding() {
    return this.invoices().reduce((s, x) => s + this.balance(x.id), 0);
  }
  revenue() {
    return this.payments().reduce((s, x) => s + Number(x.amount), 0);
  }
  private async changed(...domains: DashboardDomain[]) {
    await this.loadAll();
    this.dashboard.invalidate(...domains);
  }
  async pay(
    invoiceId: string,
    amount: number,
    method: string,
    reference: string,
    idempotencyKey: string,
  ) {
    await firstValueFrom(this.api.pay(invoiceId, { amount, method, reference }, idempotencyKey));
    await this.changed('billing');
  }
  async requestRefund(paymentId: string, amount: number, reason: string) {
    await firstValueFrom(this.api.requestRefund(paymentId, { amount, reason }));
    await this.changed('billing');
  }
  async approveRefund(id: string, _actor: string) {
    await firstValueFrom(this.api.resolveRefund(id, 'Approved'));
    await this.changed('billing');
  }
  async bookAmbulance(v: any) {
    await firstValueFrom(this.api.bookAmbulance(v));
    await this.changed('ambulance');
  }
  async saveInventory(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateInventory(id, v) : this.api.createInventory(v));
    await this.changed('inventory');
  }
  async removeInventory(id: string) {
    await firstValueFrom(this.api.removeInventory(id));
    await this.changed('inventory');
  }
  async saveSupplier(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateSupplier(id, v) : this.api.createSupplier(v));
    await this.loadAll();
  }
  async removeSupplier(id: string) {
    await firstValueFrom(this.api.removeSupplier(id));
    await this.loadAll();
  }
  async saveAmbulance(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateAmbulance(id, v) : this.api.createAmbulance(v));
    await this.changed('ambulance');
  }
  async removeAmbulance(id: string) {
    await firstValueFrom(this.api.removeAmbulance(id));
    await this.changed('ambulance');
  }
  async savePurchaseOrder(v: any, id?: string) {
    await firstValueFrom(
      id ? this.api.updatePurchaseOrder(id, v) : this.api.createPurchaseOrder(v),
    );
    await this.changed('operations', 'inventory');
  }
  async receivePurchaseOrder(id: string, quantity: number, batchId?: string) {
    await firstValueFrom(this.api.receivePurchaseOrder(id, { quantity, batchId }));
    await this.changed('operations', 'inventory', 'pharmacy');
  }
  async collectSample(id: string, actor: string) {
    await firstValueFrom(this.api.labStatus(id, { status: 'Sample Collected', actor }));
    await this.changed('laboratory');
  }
  async enterLabResults(id: string, results: any[]) {
    await firstValueFrom(this.api.labResult(id, { actor: 'Current user', results }));
    await this.changed('laboratory');
  }
  async verifyLab(id: string, actor: string) {
    await firstValueFrom(this.api.labStatus(id, { status: 'Verified', actor }));
    await this.changed('laboratory');
  }
  async submitClaim(v: any) {
    await firstValueFrom(this.api.createClaim(v));
    await this.changed('insurance');
  }
  async updateClaim(id: string, status: string, amount: number, _note: string) {
    await firstValueFrom(this.api.updateClaim(id, { status, approvedAmount: amount }));
    await this.changed('insurance');
  }
  async saveRadiology(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateRadiology(id, v) : this.api.createRadiology(v));
    await this.changed('radiology');
  }
  async saveInvoice(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateInvoice(id, v) : this.api.createInvoice(v));
    await this.changed('billing');
  }
  async saveProvider(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updateProvider(id, v) : this.api.createProvider(v));
    await this.changed('insurance');
  }
  async removeProvider(id: string) {
    await firstValueFrom(this.api.removeProvider(id));
    await this.changed('insurance');
  }
  async savePolicy(v: any, id?: string) {
    await firstValueFrom(id ? this.api.updatePolicy(id, v) : this.api.createPolicy(v));
    await this.changed('insurance');
  }
}
