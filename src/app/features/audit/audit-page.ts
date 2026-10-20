import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuditEvent, AuditStore } from '../../core/services/audit.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { SearchField } from '../../shared/components/search/search-field';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';

@Component({
  imports: [
    SearchField,
    AppPagination,
    EmptyState,
    StatusBadge,
    SharedFilter,
    TableSortHeader,
    ColumnConfig,
    AppIcon,
  ],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  readonly store = inject(AuditStore);
  private readonly dates = inject(AppDateTimeService);
  private readonly router = inject(Router);
  private readonly tablePreferences = inject(TablePreferencesService);
  readonly search = signal('');
  readonly module = signal('');
  readonly action = signal('');
  readonly userId = signal('');
  readonly entityType = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly sort = signal<TableSort | null>({ field: 'createdAt', direction: 'desc' });
  readonly dateRangeInvalid = computed(
    () => !!this.from() && !!this.to() && this.from() > this.to(),
  );
  readonly activeFilterCount = computed(
    () =>
      [
        this.module(),
        this.action(),
        this.userId(),
        this.entityType(),
        this.from(),
        this.to(),
      ].filter(Boolean).length,
  );
  readonly columns: readonly TableColumnDefinition[] = [
    {
      id: 'date',
      header: 'Date & time',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'createdAt',
    },
    { id: 'user', header: 'User', visibleByDefault: true, sortable: true, sortKey: 'user' },
    { id: 'module', header: 'Module', visibleByDefault: true, sortable: true, sortKey: 'module' },
    { id: 'action', header: 'Action', visibleByDefault: true, sortable: true, sortKey: 'action' },
    {
      id: 'target',
      header: 'Affected resource',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'entityType',
    },
    { id: 'description', header: 'Details', visibleByDefault: true },
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('audit-log', this.columns));

  constructor() {
    void Promise.all([this.load(), this.store.loadOptions().catch(() => undefined)]);
    void this.tablePreferences
      .loadRemote('audit-log', this.columns)
      .then((ids) => this.visibleColumns.set(ids));
  }

  load() {
    return this.store.load({
      search: this.search(),
      module: this.module(),
      action: this.action(),
      userId: this.userId(),
      entityType: this.entityType(),
      from: this.from(),
      to: this.to(),
      page: this.page(),
      pageSize: this.pageSize(),
      sortBy: this.sort()?.field,
      sortOrder: this.sort()?.direction,
    });
  }

  query(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.load();
  }

  apply() {
    if (this.dateRangeInvalid()) return;
    this.page.set(1);
    void this.load();
  }

  clear() {
    this.module.set('');
    this.action.set('');
    this.userId.set('');
    this.entityType.set('');
    this.from.set('');
    this.to.set('');
    this.apply();
  }

  go(value: number) {
    this.page.set(value);
    void this.load();
  }

  resize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
    void this.load();
  }

  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.load();
  }

  open(event: AuditEvent) {
    void this.router.navigate(['/audit-logs', event.id]);
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
      this.sort.set({ field: 'createdAt', direction: 'desc' });
    this.visibleColumns.set(ids);
    await this.tablePreferences.save('audit-log', ids);
  }

  async resetColumns() {
    await this.tablePreferences.reset('audit-log');
    this.visibleColumns.set(this.tablePreferences.load('audit-log', this.columns));
  }

  format(value: string) {
    return this.dates.formatDateTime(value);
  }

  label(value: string) {
    return value
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  metadataSummary(value: unknown) {
    if (!value) return 'No additional metadata';
    const text = JSON.stringify(value);
    return text.length > 100 ? `${text.slice(0, 97)}…` : text;
  }
}
