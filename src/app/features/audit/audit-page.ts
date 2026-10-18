import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuditStore } from '../../core/services/audit.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { SearchField } from '../../shared/components/search/search-field';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { SharedExport } from '../../shared/components/export/shared-export';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
@Component({
  imports: [SearchField, AppPagination, EmptyState, StatusBadge, SharedFilter, SharedExport, TableSortHeader, ColumnConfig],
  templateUrl: './audit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  readonly exporting = signal(false);
  private store = inject(AuditStore);
  private dates = inject(AppDateTimeService);
  private tablePreferences = inject(TablePreferencesService);
  readonly search = signal('');
  readonly module = signal('');
  readonly action = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly selected = signal<any | null>(null);
  readonly sort = signal<TableSort | null>(null);
  readonly columns: readonly TableColumnDefinition[] = [
    { id: 'date', header: 'Date & time', visibleByDefault: true, required: true, sortable: true, sortKey: 'createdAt' },
    { id: 'user', header: 'User', visibleByDefault: true, sortable: true, sortKey: 'user' },
    { id: 'action', header: 'Action', visibleByDefault: true, sortable: true, sortKey: 'action' },
    { id: 'module', header: 'Module', visibleByDefault: true, sortable: true, sortKey: 'module' },
    { id: 'target', header: 'Target', visibleByDefault: true, sortable: true, sortKey: 'entityType' },
    { id: 'description', header: 'Description', visibleByDefault: true },
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('audit-log', this.columns));
  readonly events = this.store.events;
  readonly modules = [
    'auth',
    'users',
    'roles',
    'settings',
    'patients',
    'appointments',
    'clinical',
    'laboratory',
    'radiology',
    'billing',
    'documents',
    'doctors',
    'employees',
  ];
  constructor() {
    void this.load();
    void this.tablePreferences.loadRemote('audit-log', this.columns).then(ids => this.visibleColumns.set(ids));
  }
  load() {
    return this.store.load({
      search: this.search(),
      module: this.module(),
      action: this.action(),
      from: this.from(),
      to: this.to(),
      page: this.page(),
      pageSize: this.pageSize(),
      sortBy: this.sort()?.field,
      sortOrder: this.sort()?.direction,
    });
  }
  query(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  apply() {
    this.page.set(1);
    void this.load();
  }
  clear() {
    this.module.set('');
    this.action.set('');
    this.from.set('');
    this.to.set('');
    this.apply();
  }
  go(v: number) {
    this.page.set(v);
    void this.load();
  }
  resize(v: number) {
    this.pageSize.set(v);
    this.page.set(1);
    void this.load();
  }
  changeSort(value: TableSort | null) { this.sort.set(value); this.page.set(1); void this.load(); }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' { const sort=this.sort(); return sort?.field===field ? (sort.direction==='asc'?'ascending':'descending') : 'none'; }
  columnVisible(id: string) { return this.visibleColumns().includes(id); }
  async applyColumns(ids: string[]) { const active=this.sort(); if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field)) this.sort.set(null); this.visibleColumns.set(ids); await this.tablePreferences.save('audit-log',ids); }
  async resetColumns() { await this.tablePreferences.reset('audit-log'); this.visibleColumns.set(this.tablePreferences.load('audit-log',this.columns)); }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
  async export() {
    if (this.exporting() || !this.events().length) return;
    this.exporting.set(true);
    try {
      const exportColumns=[{id:'date',header:'Date/time',value:(e:any)=>this.format(e.at)},{id:'user',header:'User',value:(e:any)=>e.actor},{id:'action',header:'Action',value:(e:any)=>e.action},{id:'module',header:'Module',value:(e:any)=>e.module},{id:'target',header:'Target',value:(e:any)=>`${e.entityType} / ${e.entityId || 'Not available'}`},{id:'description',header:'Description',value:(e:any)=>e.detail}].filter(column=>this.columnVisible(column.id));
      const rows=[exportColumns.map(column=>column.header),...this.events().map(e=>exportColumns.map(column=>column.value(e)))];
      const blob = new Blob([rows.map((row) => row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'audit-log.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
}
