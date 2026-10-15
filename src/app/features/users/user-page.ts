import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { SearchField } from '../../shared/components/search/search-field';
import { ManagedUser, UserApiService } from './user-api.service';
import { NotificationStore } from '../../core/notifications/notification.store';
import { UserForm } from './user-create';
import { AppModal } from '../../shared/components/modal/app-modal';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { AuthStore } from '../../core/auth/auth.store';
import { ResetPasswordForm } from './reset-password-form';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { AdministrationApiService, RoleRecord } from '../administration/administration-api.service';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';import { ColumnConfig } from '../../shared/components/column-config/column-config';import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';import { TablePreferencesService } from '../../core/services/table-preferences.service';
@Component({
  imports: [
    DatePipe,
    EmptyState,
    SearchField,
    UserForm,
    AppModal,
    AppActionsMenu,
    StatusBadge,
    ResetPasswordForm,
    AppPagination,
    ClickOutsideDirective,
    AppIcon,
    TableSortHeader,ColumnConfig,
  ],
  templateUrl: './user-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPage {
  private api = inject(UserApiService);
  private notifications = inject(NotificationStore);
  private toast = inject(ToastService);
  private confirmation = inject(ConfirmationService);
  private administration = inject(AdministrationApiService);
  private tablePreferences=inject(TablePreferencesService);
  readonly auth = inject(AuthStore);
  readonly users = signal<ManagedUser[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly filtersOpen = signal(false);
  readonly exporting = signal(false);
  readonly status = signal('');
  readonly role = signal('');
  readonly roles = signal<RoleRecord[]>([]);
  readonly createOpen = signal(false);
  readonly editing = signal<ManagedUser | null>(null);
  readonly resetting = signal<ManagedUser | null>(null);
  readonly sort=signal<TableSort|null>(null);readonly columns:readonly TableColumnDefinition[]=[{id:'user',header:'User',visibleByDefault:true,required:true,sortable:true,sortKey:'firstName'},{id:'role',header:'Role',visibleByDefault:true},{id:'phone',header:'Phone',visibleByDefault:true,sortable:true,sortKey:'phone'},{id:'created',header:'Created',visibleByDefault:true,sortable:true,sortKey:'createdAt'},{id:'login',header:'Last login',visibleByDefault:true,sortable:true,sortKey:'lastLoginAt'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];readonly visibleColumns=signal(this.tablePreferences.load('users',this.columns));
  constructor() {
    void this.load();
    void firstValueFrom(this.administration.roles({ pageSize: 100, status: 'ACTIVE' })).then((r) =>
      this.roles.set(r.data),
    );
    void this.tablePreferences.loadRemote('users',this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const r = await firstValueFrom(
        this.api.list({
          page: this.page(),
          pageSize: this.pageSize(),
          search: this.search(),
          status: this.status(),
          role: this.role(),
          sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
        }),
      );
      this.users.set(r.data);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } finally {
      this.loading.set(false);
    }
  }
  query(value: string) {
    this.search.set(value);
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
    this.role.set('');
    this.applyFilters();
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
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}columnVisible(id:string){return this.visibleColumns().includes(id);}async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('users',ids);}async resetColumns(){await this.tablePreferences.reset('users');this.visibleColumns.set(this.tablePreferences.load('users',this.columns));}
  async export() {
    if (this.exporting() || !this.total() || !this.auth.has('users.export')) return;
    this.exporting.set(true);
    try {
      const result = await firstValueFrom(
        this.api.list({
          page: 1,
          pageSize: 100,
          search: this.search(),
          status: this.status(),
          role: this.role(),
          sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
        }),
      );
      const exportColumns=[{id:'user',header:'User',value:(u:ManagedUser)=>`${u.firstName} ${u.lastName} / ${u.email}`},{id:'role',header:'Role',value:(u:ManagedUser)=>this.roleName(u)},{id:'phone',header:'Phone',value:(u:ManagedUser)=>u.phone??''},{id:'created',header:'Created',value:(u:ManagedUser)=>u.createdAt},{id:'login',header:'Last login',value:(u:ManagedUser)=>u.lastLoginAt??''},{id:'status',header:'Status',value:(u:ManagedUser)=>u.status}].filter(column=>this.columnVisible(column.id));
      const csv=[exportColumns.map(column=>column.header),...result.data.map(user=>exportColumns.map(column=>column.value(user)))].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'users.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
  openCreate() {
    this.createOpen.set(true);
  }
  open(user: ManagedUser) {
    this.editing.set(user);
  }
  async onCreated() {
    await this.load();
    void this.notifications.load();
  }
  async onUpdated() {
    await this.load();
    void this.notifications.load();
  }
  async remove(user: ManagedUser) {
    if (
      await this.confirmation.confirm({
        title: 'Delete user?',
        message: 'This user will lose application access.',
        context: `${user.firstName} ${user.lastName}`,
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      await firstValueFrom(this.api.remove(user.id));
      await this.load();
      this.toast.success('User deleted.');
    }
  }
  roleName(user: ManagedUser) {
    return user.roles[0]?.role.name ?? 'Unassigned';
  }
}
