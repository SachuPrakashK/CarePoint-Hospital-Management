import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppModal } from '../../shared/components/modal/app-modal';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { MasterApiService, MasterType } from './master-api.service';
import { MasterForm } from './master-form';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { SearchField } from '../../shared/components/search/search-field';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { DisplayValuePipe } from '../../shared/pipes/display-value.pipe';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
@Component({
  imports: [RouterLink, AppModal, AppPagination, EmptyState, MasterForm, AppActionsMenu, SearchField, StatusBadge, DisplayValuePipe, AppIcon, SharedFilter, TableSortHeader, ColumnConfig],
  templateUrl: './entity-page.html',
})
export class EntityPage {
  private route = inject(ActivatedRoute);
  private api = inject(MasterApiService);
  private confirm = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly key = computed(
    () => this.route.snapshot.parent?.data['entity'] ?? 'departments',
  );
  readonly supported = computed(() =>
    ['departments', 'specializations', 'radiology-investigations', 'laboratory-tests'].includes(
      this.key(),
    ),
  );
  readonly type = computed(() => this.key() as MasterType);
  readonly title = computed(
    () =>
      ({
        departments: 'Departments',
        specializations: 'Specializations',
        'radiology-investigations': 'Radiology Investigations',
        'laboratory-tests': 'Laboratory Test Definitions',
      })[this.type()],
  );
  readonly singular = computed(
    () =>
      ({
        departments: 'Department',
        specializations: 'Specialization',
        'radiology-investigations': 'Radiology Investigation',
        'laboratory-tests': 'Laboratory Test Definition',
      })[this.type()],
  );
  readonly description = computed(
    () =>
      ({
        departments: 'Configurable clinical and service departments.',
        specializations: 'Specialist disciplines associated with departments.',
        'radiology-investigations':
          'Database-managed investigations available to radiology orders.',
        'laboratory-tests': 'Database-managed tests available to laboratory orders.',
      })[this.type()],
  );
  readonly items = signal<any[]>([]);
  readonly departments = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly modal = signal(false);
  readonly editing = signal<any | null>(null);
  readonly masterDirty = signal(false);
  readonly search = signal('');
  readonly status = signal('');
  readonly category = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly deletingId = signal('');
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'name',header:'Name',visibleByDefault:true,required:true,sortable:true,sortKey:'name'},{id:'code',header:'Code',visibleByDefault:true,sortable:true,sortKey:'code'},{id:'department',header:'Department',visibleByDefault:true,sortable:true,sortKey:'department'},{id:'modality',header:'Modality',visibleByDefault:true,sortable:true,sortKey:'modality'},{id:'category',header:'Category',visibleByDefault:true,sortable:true,sortKey:'category'},{id:'unit',header:'Unit',visibleByDefault:true,sortable:true,sortKey:'unit'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];
  readonly visibleColumns=signal<string[]>([]);
  private tableId(){return `administration-${this.type()}`;}
  constructor() {
    this.visibleColumns.set(this.tablePreferences.load(this.tableId(),this.applicableColumns()));
    void this.load();
    void this.tablePreferences.loadRemote(this.tableId(),this.applicableColumns()).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    if (!this.supported()) return;
    this.loading.set(true);
    try {
      const r = await firstValueFrom(
        this.api.list(this.type(), this.search(), this.status(), this.page(), this.pageSize(), this.category(),this.sort()?.field,this.sort()?.direction??''),
      );
      this.items.set(r.data);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
      if (this.type() === 'specializations') {
        const d = await firstValueFrom(this.api.list('departments', '', 'Active', 1, 100));
        this.departments.set(d.data);
      }
    } catch {
      this.error.set('Master records could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  queryChanged() {
    this.page.set(1);
    void this.load();
  }
  clearFilters() { this.status.set(''); this.category.set(''); this.queryChanged(); }
  go(page: number) {
    this.page.set(page);
    void this.load();
  }
  resize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    void this.load();
  }
  applicableColumns(){return this.columns.filter(column=>!['department','modality','category','unit'].includes(column.id)||(column.id==='department'&&this.type()==='specializations')||(column.id==='modality'&&this.type()==='radiology-investigations')||(['category','unit'].includes(column.id)&&this.type()==='laboratory-tests'));}
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.applicableColumns().some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save(this.tableId(),ids);}
  async resetColumns(){await this.tablePreferences.reset(this.tableId());this.visibleColumns.set(this.tablePreferences.load(this.tableId(),this.applicableColumns()));}
  open(item: any = null) {
    this.editing.set(item);
    this.masterDirty.set(false);
    this.modal.set(true);
  }
  async remove(item: any) {
    if (this.deletingId()) return;
    const ok = await this.confirm.confirm({
      title: `Delete ${item.name}?`,
      message: 'Unused records may be removed. Records referenced by hospital history will be safely retired so existing relationships remain valid.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.deletingId.set(item.id);
    try {
      await firstValueFrom(this.api.deactivate(this.type(), item.id));
      this.toast.success(`${this.singular()} deleted.`);
      await this.load();
    } finally {
      this.deletingId.set('');
    }
  }
  async changed() {
    this.toast.success(this.editing() ? 'Master record updated.' : 'Master record created.');
    await this.load();
  }
}
