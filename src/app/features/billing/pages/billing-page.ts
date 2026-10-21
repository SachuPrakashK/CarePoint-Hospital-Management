import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { Phase23Store } from '../../../core/services/phase23.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { BillForm } from './bill-form';
import { PaymentForm } from './payment-form';
import { RefundForm } from './refund-form';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';
@Component({
  imports: [
    RouterLink,
    AppModal,
    BillForm,
    PaymentForm,
    RefundForm,
    StatusBadge,
    SearchField,
    AppPagination,
    TableSortHeader,
    ColumnConfig,
    SummaryCard,
  ],
  templateUrl: './billing-page.html',
})
export class BillingPage {
  readonly store = inject(Phase23Store);
  private dates = inject(AppDateTimeService);
  private api = inject(Phase23ApiService);
  private preferences = inject(TablePreferencesService);
  readonly tab = signal<'invoices' | 'payments' | 'refunds'>('invoices');
  readonly paymentInvoice = signal<{ id: string; amount: number } | null>(null);
  readonly refundPayment = signal<{ id: string; amount: number } | null>(null);
  readonly invoiceModal = signal(false);
  readonly editing = signal<any | null>(null);
  readonly dirty = signal(false);
  readonly message = signal('');
  readonly rows = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly sort = signal<TableSort | null>(null);
  readonly tableColumns: Record<string, readonly TableColumnDefinition[]> = {
    invoices: [
      {
        id: 'number',
        header: 'Invoice',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'number',
      },
      {
        id: 'patient',
        header: 'Patient',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'patient',
      },
      { id: 'date', header: 'Date', visibleByDefault: true, sortable: true, sortKey: 'createdAt' },
      { id: 'total', header: 'Total', visibleByDefault: true },
      { id: 'paid', header: 'Paid', visibleByDefault: true },
      { id: 'balance', header: 'Balance', visibleByDefault: true },
      { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
      { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
    ],
    payments: [
      {
        id: 'receipt',
        header: 'Receipt',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'receiptNumber',
      },
      {
        id: 'invoice',
        header: 'Invoice',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'invoice',
      },
      { id: 'date', header: 'Date', visibleByDefault: true, sortable: true, sortKey: 'paidAt' },
      { id: 'amount', header: 'Amount', visibleByDefault: true, sortable: true, sortKey: 'amount' },
      { id: 'method', header: 'Method', visibleByDefault: true, sortable: true, sortKey: 'method' },
      {
        id: 'reference',
        header: 'Reference',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'reference',
      },
      { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
    ],
    refunds: [
      {
        id: 'date',
        header: 'Date',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'createdAt',
      },
      {
        id: 'payment',
        header: 'Payment',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'payment',
      },
      { id: 'amount', header: 'Amount', visibleByDefault: true, sortable: true, sortKey: 'amount' },
      { id: 'reason', header: 'Reason', visibleByDefault: true, sortable: true, sortKey: 'reason' },
      { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
      { id: 'approval', header: 'Approval', visibleByDefault: true, required: true },
    ],
  };
  readonly visibleColumns = signal<string[]>(
    this.preferences.load('billing-invoices', this.tableColumns['invoices']),
  );
  constructor() {
    void this.loadTable();
    void this.preferences
      .loadRemote('billing-invoices', this.columns())
      .then((ids) => this.visibleColumns.set(ids));
  }
  columns() {
    return this.tableColumns[this.tab()];
  }
  tableId() {
    return `billing-${this.tab()}`;
  }
  columnVisible(id: string) {
    return this.visibleColumns().includes(id);
  }
  async selectTab(value: 'invoices' | 'payments' | 'refunds') {
    this.tab.set(value);
    this.page.set(1);
    this.sort.set(null);
    this.search.set('');
    this.visibleColumns.set(this.preferences.load(this.tableId(), this.columns()));
    this.visibleColumns.set(await this.preferences.loadRemote(this.tableId(), this.columns()));
    await this.loadTable();
  }
  async loadTable() {
    this.loading.set(true);
    this.error.set('');
    try {
      const q = {
        page: this.page(),
        page_size: this.pageSize(),
        search: this.search(),
        sort_by: this.sort()?.field,
        sort_order: this.sort()?.direction,
      };
      const request =
        this.tab() === 'invoices'
          ? this.api.invoices(q)
          : this.tab() === 'payments'
            ? this.api.payments(q)
            : this.api.refunds(q);
      const r = await firstValueFrom(request);
      this.rows.set(
        this.tab() === 'invoices'
          ? r.data.map((x: any) => ({
              ...x,
              patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
            }))
          : r.data,
      );
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set('Billing records could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  query(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  go(value: number) {
    this.page.set(value);
    void this.loadTable();
  }
  resize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const value = this.sort();
    return value?.field === field
      ? value.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  async applyColumns(ids: string[]) {
    const active = this.sort();
    if (active && !this.columns().some((x) => ids.includes(x.id) && x.sortKey === active.field))
      this.sort.set(null);
    this.visibleColumns.set(ids);
    await this.preferences.save(this.tableId(), ids);
  }
  async resetColumns() {
    await this.preferences.reset(this.tableId());
    this.visibleColumns.set(this.preferences.load(this.tableId(), this.columns()));
  }
  totals(invoice: any) {
    const total = (invoice.items ?? []).reduce(
      (sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice),
      0,
    );
    const paid = (invoice.payments ?? []).reduce((sum: number, item: any) => {
      const refunded = (item.refunds ?? [])
        .filter((refund: any) => refund.status === 'Approved')
        .reduce((value: number, refund: any) => value + Number(refund.amount), 0);
      return sum + Number(item.amount) - refunded;
    }, 0);
    return { total, paid, balance: total - paid };
  }
  openInvoice(item: any = null) {
    this.editing.set(item);
    this.invoiceModal.set(true);
    this.dirty.set(false);
  }
  closeInvoice() {
    this.invoiceModal.set(false);
    this.editing.set(null);
  }
  invoiceSaved() {
    this.message.set(this.editing() ? 'Invoice updated.' : 'Invoice created.');
  }
  openInvoices() {
    return this.store
      .invoices()
      .filter((i) => !['Paid', 'Cancelled', 'Refunded'].includes(i.status)).length;
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
  invoiceNumber(id: string) {
    return this.store.invoices().find((i) => i.id === id)?.number ?? id;
  }
  paymentSaved() {
    this.message.set('Payment recorded.');
    void this.loadTable();
  }
  refundSaved() {
    this.message.set('Refund requested.');
    this.tab.set('refunds');
    void this.selectTab('refunds');
  }
}
