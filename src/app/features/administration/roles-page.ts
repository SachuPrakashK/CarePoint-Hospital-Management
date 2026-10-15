import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApiService,
  PermissionRecord,
  RoleRecord,
} from './administration-api.service';
import { SearchField } from '../../shared/components/search/search-field';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppModal } from '../../shared/components/modal/app-modal';
import { RoleForm } from './role-form';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { formatPermissionLabel } from '../../shared/utils/permission-label';
@Component({
  imports: [
    SearchField,
    AppActionsMenu,
    StatusBadge,
    AppPagination,
    EmptyState,
    AppModal,
    RoleForm,
    ClickOutsideDirective,
    AppIcon,
    TableSortHeader,
    ColumnConfig,
  ],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private api = inject(AdministrationApiService);
  private confirm = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly auth = inject(AuthStore);
  readonly items = signal<RoleRecord[]>([]);
  readonly permissions = signal<PermissionRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly search = signal('');
  readonly status = signal('');
  readonly filtersOpen = signal(false);
  readonly exporting = signal(false);
  readonly modal = signal(false);
  readonly editLoading = signal<string | null>(null);
  readonly editing = signal<RoleRecord | null>(null);
  readonly viewing = signal<RoleRecord | null>(null);
  readonly dirty = signal(false);
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'role',header:'Role',visibleByDefault:true,required:true,sortable:true,sortKey:'name'},{id:'description',header:'Description',visibleByDefault:true,sortable:true,sortKey:'description'},{id:'users',header:'Users',visibleByDefault:true,sortable:true,sortKey:'users'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'created',header:'Created on',visibleByDefault:true,sortable:true,sortKey:'createdAt'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];
  readonly visibleColumns=signal(this.tablePreferences.load('administration-roles',this.columns));
  readonly formatPermissionLabel = formatPermissionLabel;
  constructor() {
    void this.load();
    void firstValueFrom(this.api.permissions()).then((r) => this.permissions.set(r.data));
    void this.tablePreferences.loadRemote('administration-roles',this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    this.loading.set(true);
    try {
      const r = await firstValueFrom(
        this.api.roles({
          page: this.page(),
          pageSize: this.pageSize(),
          search: this.search(),
          status: this.status(),
          sortBy:this.sort()?.field, sortOrder:this.sort()?.direction,
        }),
      );
      this.items.set(r.data);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set('Roles could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  async open(role: RoleRecord | null = null) {
    this.viewing.set(null);
    if (role) {
      if (this.editLoading()) return;
      this.editLoading.set(role.id);
      try {
        const response = await firstValueFrom(this.api.role(role.id));
        this.editing.set(response.data);
      } catch {
        this.toast.error('Role details could not be loaded.');
        return;
      } finally {
        this.editLoading.set(null);
      }
    } else this.editing.set(null);
    this.dirty.set(false);
    this.modal.set(true);
  }
  view(role: RoleRecord) {
    this.modal.set(false);
    this.viewing.set(role);
  }
  async remove(role: RoleRecord) {
    if (
      await this.confirm.confirm({
        title: `Delete ${role.name}?`,
        message: 'Only unassigned custom roles can be deleted.',
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      await firstValueFrom(this.api.deleteRole(role.id));
      this.toast.success('Role deleted.');
      await this.load();
    }
  }
  query(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.load();
  }
  go(page: number) {
    this.page.set(page);
    void this.load();
  }
  resize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    void this.load();
  }
  applyFilters() {
    this.page.set(1);
    this.filtersOpen.set(false);
    void this.load();
  }
  clearFilters() {
    this.status.set('');
    this.applyFilters();
  }
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('administration-roles',ids);}
  async resetColumns(){await this.tablePreferences.reset('administration-roles');this.visibleColumns.set(this.tablePreferences.load('administration-roles',this.columns));}
  async export() {
    if (this.exporting() || !this.total()) return;
    this.exporting.set(true);
    try {
      const result = await firstValueFrom(
        this.api.roles({ page: 1, pageSize: 100, search: this.search(), status: this.status(), sortBy:this.sort()?.field,sortOrder:this.sort()?.direction }),
      );
      const exportColumns=[{id:'role',header:'Role',value:(r:RoleRecord)=>`${r.name} (${r.code})`},{id:'description',header:'Description',value:(r:RoleRecord)=>r.description??''},{id:'users',header:'Users',value:(r:RoleRecord)=>r._count.users},{id:'status',header:'Status',value:(r:RoleRecord)=>r.status},{id:'created',header:'Created On',value:(r:RoleRecord)=>r.createdAt}].filter(column=>this.columnVisible(column.id));
      const csv=[exportColumns.map(column=>column.header),...result.data.map(role=>exportColumns.map(column=>column.value(role)))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'roles.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
  async changed() {
    await this.load();
    this.modal.set(false);
  }
}
