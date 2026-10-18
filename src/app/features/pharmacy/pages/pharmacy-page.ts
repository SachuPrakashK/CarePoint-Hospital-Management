import { Component, computed, inject, signal } from '@angular/core';
import { PharmacyStore } from '../../../core/services/pharmacy.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { PharmacyForm } from './pharmacy-form';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
import { SharedExport } from '../../../shared/components/export/shared-export';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';

@Component({
  imports: [
    AppModal,
    PharmacyForm,
    StatusBadge,
    SearchField,
    AppPagination,
    EmptyState,
    SharedFilter,
    SharedExport,
    TableSortHeader,
    ColumnConfig,
    SummaryCard,
  ],
  templateUrl: './pharmacy-page.html',
  styleUrl: './pharmacy-page.scss',
})
export class PharmacyPage {
  readonly store = inject(PharmacyStore);
  readonly auth = inject(AuthStore);
  private dates = inject(AppDateTimeService);
  private tablePreferences = inject(TablePreferencesService);
  readonly tab = signal<'queue' | 'stock' | 'ledger'>('queue');
  readonly message = signal('');
  readonly formKind = signal<'medicine' | 'batch' | null>(null);
  readonly editing = signal<any | null>(null);
  readonly formDirty = signal(false);
  readonly search = signal('');
  readonly category = signal('');
  readonly lowStock = signal(false);
  readonly expiry = signal('');
  readonly draftCategory = signal('');
  readonly draftLowStock = signal(false);
  readonly draftExpiry = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly exporting = signal(false);
  readonly sort = signal<TableSort | null>(null);
  readonly columns: readonly TableColumnDefinition[] = [
    {
      id: 'medicine',
      header: 'Medicine',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'medicine',
    },
    { id: 'generic', header: 'Generic / Brand', visibleByDefault: true },
    { id: 'category', header: 'Category', visibleByDefault: true },
    {
      id: 'batch',
      header: 'Batch',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'batchNumber',
    },
    {
      id: 'expiry',
      header: 'Expiry',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'expiresAt',
    },
    {
      id: 'price',
      header: 'Purchase / Sale',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'purchasePrice',
    },
    {
      id: 'available',
      header: 'Available',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'quantity',
    },
    { id: 'stock', header: 'Stock', visibleByDefault: true },
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('pharmacy-stock', this.columns));
  constructor() {
    void this.tablePreferences
      .loadRemote('pharmacy-stock', this.columns)
      .then((ids) => this.visibleColumns.set(ids));
  }
  readonly activeFilterCount = computed(
    () => [this.category(), this.lowStock(), this.expiry()].filter(Boolean).length,
  );
  readonly hasCriteria = computed(() => !!this.search().trim() || this.activeFilterCount() > 0);
  readonly filtersDisabled = computed(
    () => !this.store.stockLoading() && this.store.stockBaseTotal() === 0,
  );
  readonly canManage = computed(() => this.auth.has('pharmacy.manage'));

  open(kind: 'medicine' | 'batch', entity: any = null) {
    this.formKind.set(kind);
    this.editing.set(entity);
    this.formDirty.set(false);
  }
  close() {
    this.formKind.set(null);
    this.editing.set(null);
    this.formDirty.set(false);
  }
  saved() {
    this.message.set(this.editing() ? 'Pharmacy record updated.' : 'Pharmacy record created.');
    this.close();
  }
  pending() {
    return this.store
      .dispenses()
      .filter((item) => !['Dispensed', 'Cancelled'].includes(item.status)).length;
  }
  medicine(id: string) {
    return this.store.medicines().find((item) => item.id === id)?.name ?? 'Not available';
  }
  generic(id: string) {
    const item = this.store.medicines().find((medicine) => medicine.id === id);
    return item ? `${item.genericName} · ${item.brand}` : 'Not available';
  }
  query() {
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      category: this.category(),
      lowStock: this.lowStock(),
      expiry: this.expiry(),
      sortBy: this.sort()?.field,
      sortOrder: this.sort()?.direction,
    };
  }
  loadStock() {
    return this.store.loadStock(this.query());
  }
  selectTab(value: 'queue' | 'stock' | 'ledger') {
    this.tab.set(value);
    if (value === 'stock') void this.loadStock();
    if (value === 'ledger') void this.store.loadLedger();
  }
  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.loadStock();
  }
  applyFilters() {
    this.category.set(this.draftCategory());
    this.lowStock.set(this.draftLowStock());
    this.expiry.set(this.draftExpiry());
    this.page.set(1);
    void this.loadStock();
  }
  clearFilters() {
    this.draftCategory.set('');
    this.draftLowStock.set(false);
    this.draftExpiry.set('');
    this.category.set('');
    this.lowStock.set(false);
    this.expiry.set('');
    this.page.set(1);
    void this.loadStock();
  }
  clearCriteria() {
    this.search.set('');
    this.clearFilters();
  }
  changePage(value: number) {
    this.page.set(value);
    void this.loadStock();
  }
  changePageSize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
    void this.loadStock();
  }
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.loadStock();
  }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    return sort?.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }
  columnVisible(id: string) {
    return this.visibleColumns().includes(id);
  }
  async applyColumns(ids: string[]) {
    const active = this.sort();
    if (
      active &&
      !this.columns.some((column) => ids.includes(column.id) && column.sortKey === active.field)
    )
      this.sort.set(null);
    this.visibleColumns.set(ids);
    await this.tablePreferences.save('pharmacy-stock', ids);
  }
  async resetColumns() {
    await this.tablePreferences.reset('pharmacy-stock');
    this.visibleColumns.set(this.tablePreferences.load('pharmacy-stock', this.columns));
  }
  format(value: string) {
    return this.dates.formatDateTime(value);
  }
  formatExpiry(value: string | null | undefined) {
    return value ? this.dates.formatDate(value) : 'Not available';
  }
  async dispense(
    id: string,
    medicineId: string,
    batchId: string,
    quantity: number,
    unitPrice: number,
  ) {
    try {
      const invoice = await this.store.dispense(id, [
        {
          medicineId,
          batchId,
          prescribedQuantity: quantity,
          dispensedQuantity: quantity,
          unitPrice,
        },
      ]);
      this.message.set(`Dispensed and added to invoice ${invoice.number}.`);
    } catch (error: any) {
      this.message.set(
        error?.error?.message ?? error?.message ?? 'Medicine could not be dispensed.',
      );
    }
  }
  exportStock() {
    if (this.exporting() || !this.store.stockBatches().length) return;
    this.exporting.set(true);
    try {
      const exportColumns = [
        { id: 'medicine', header: 'Medicine', value: (item: any) => item.medicine?.name },
        {
          id: 'generic',
          header: 'Generic / Brand',
          value: (item: any) =>
            `${item.medicine?.genericName ?? ''} / ${item.medicine?.brand ?? ''}`,
        },
        { id: 'category', header: 'Category', value: (item: any) => item.medicine?.category },
        { id: 'batch', header: 'Batch', value: (item: any) => item.batchNumber },
        { id: 'expiry', header: 'Expiry', value: (item: any) => this.formatExpiry(item.expiresAt) },
        {
          id: 'price',
          header: 'Purchase / Sale',
          value: (item: any) => `${item.purchasePrice} / ${item.sellingPrice}`,
        },
        { id: 'available', header: 'Available', value: (item: any) => item.quantity },
        {
          id: 'stock',
          header: 'Stock',
          value: (item: any) => (item.lowStock ? 'Low Stock' : 'Healthy'),
        },
      ].filter((column) => this.columnVisible(column.id));
      const rows = [
        exportColumns.map((column) => column.header),
        ...this.store
          .stockBatches()
          .map((item) => exportColumns.map((column) => column.value(item))),
      ];
      const blob = new Blob(
        [
          rows
            .map((row) =>
              row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','),
            )
            .join('\r\n'),
        ],
        { type: 'text/csv' },
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'medicine-stock.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      this.exporting.set(false);
    }
  }
}
