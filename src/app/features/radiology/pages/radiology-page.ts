import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Phase23Store } from '../../../core/services/phase23.store';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { SearchField } from '../../../shared/components/search/search-field';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { RadiologyForm } from './radiology-form';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
import { SharedExport } from '../../../shared/components/export/shared-export';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ToastService } from '../../../core/services/toast.service';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { TableSort } from '../../../shared/models/table.models';
import { TableColumnDefinition } from '../../../shared/models/table.models';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
@Component({
  imports: [
    AppModal,
    RadiologyForm,
    RouterLink,
    AppPagination,
    SearchField,
    EmptyState,
    AppActionsMenu,
    StatusBadge,
    SharedFilter,
    SharedExport,
    TableSortHeader,
    ColumnConfig,
  ],
  templateUrl: './radiology-page.html',
  styleUrl: './radiology-page.scss',
})
export class RadiologyPage {
  readonly store = inject(Phase23Store);
  private api = inject(Phase23ApiService);
  private dates = inject(AppDateTimeService);
  private router = inject(Router);
  private confirm = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly modal = signal(false);
  readonly editing = signal<any | null>(null);
  readonly dirty = signal(false);
  readonly message = signal('');
  open(item: any = null) {
    this.editing.set(item);
    this.modal.set(true);
    this.dirty.set(false);
  }
  close() {
    this.modal.set(false);
    this.editing.set(null);
  }
  saved() {
    this.message.set(this.editing() ? 'Radiology order updated.' : 'Radiology order created.');
  }
  readonly items = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly search = signal('');
  readonly status = signal('');
  readonly investigation = signal('');
  readonly draftStatus = signal('');
  readonly draftInvestigation = signal('');
  readonly exporting = signal(false);
  readonly deletingId = signal('');
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'order',header:'Order',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},{id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'patient'},{id:'investigation',header:'Investigation',visibleByDefault:true,sortable:true,sortKey:'investigation'},{id:'doctor',header:'Requested by',visibleByDefault:true,sortable:true,sortKey:'doctor'},{id:'schedule',header:'Schedule',visibleByDefault:true,sortable:true,sortKey:'scheduledAt'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'action',header:'Action',visibleByDefault:true,required:true}];
  readonly visibleColumns=signal(this.tablePreferences.load('radiology-orders',this.columns));
  constructor() {
    void this.load();
    void this.tablePreferences.loadRemote('radiology-orders',this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.api.radiologyOrders({
          page: this.page(),
          page_size: this.pageSize(),
          search: this.search(),
          status: this.status(),
          investigation: this.investigation(),
          sort_by:this.sort()?.field,sort_order:this.sort()?.direction,
        }),
      );
      this.items.set(
        r.data.map((x) => ({
          ...x,
          patientName: `${x.patient?.firstName ?? ''} ${x.patient?.lastName ?? ''}`.trim(),
        })),
      );
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set('Radiology orders could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  searchChanged(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  applyFilters() {
    this.status.set(this.draftStatus());
    this.investigation.set(this.draftInvestigation());
    this.page.set(1);
    void this.load();
  }
  clearFilters() { this.draftStatus.set(''); this.draftInvestigation.set(''); this.applyFilters(); }
  go(v: number) {
    this.page.set(v);
    void this.load();
  }
  resize(v: number) {
    this.pageSize.set(v);
    this.page.set(1);
    void this.load();
  }
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('radiology-orders',ids);}
  async resetColumns(){await this.tablePreferences.reset('radiology-orders');this.visibleColumns.set(this.tablePreferences.load('radiology-orders',this.columns));}
  async refreshSaved() {
    this.saved();
    await this.load();
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
  view(item: any) { void this.router.navigate(['/radiology', item.id]); }
  rowKey(event: KeyboardEvent, item: any) { if (event.key === 'Enter') this.view(item); }
  async remove(item: any) {
    if (this.deletingId()) return;
    if (!(await this.confirm.confirm({ title: `Delete ${item.number}?`, message: 'The order will be safely cancelled so radiology history remains available.', confirmLabel: 'Delete', danger: true }))) return;
    this.deletingId.set(item.id);
    try { await firstValueFrom(this.api.cancelRadiology(item.id)); this.toast.success('Radiology order deleted.'); await this.load(); }
    finally { this.deletingId.set(''); }
  }
  exportOrders() {
    if (this.exporting() || !this.items().length) return;
    this.exporting.set(true);
    try {
      const exportColumns=[{id:'order',header:'Order',value:(o:any)=>o.number},{id:'patient',header:'Patient',value:(o:any)=>o.patientName},{id:'investigation',header:'Investigation',value:(o:any)=>o.investigation},{id:'doctor',header:'Doctor',value:(o:any)=>o.doctor},{id:'schedule',header:'Schedule',value:(o:any)=>o.scheduledAt?this.format(o.scheduledAt):''},{id:'status',header:'Status',value:(o:any)=>o.status}].filter(column=>this.columnVisible(column.id));
      const rows = [exportColumns.map(column=>column.header), ...this.items().map(o => exportColumns.map(column=>column.value(o)))];
      const blob = new Blob([rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'radiology-orders.csv'; link.click(); URL.revokeObjectURL(url);
    } finally { this.exporting.set(false); }
  }
}
