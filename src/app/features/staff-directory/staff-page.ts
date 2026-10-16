import { Permission } from '../../core/models/auth.models';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppModal } from '../../shared/components/modal/app-modal';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { SearchField } from '../../shared/components/search/search-field';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import {
  StaffDirectoryApiService,
  StaffKind,
  StaffOptions,
  StaffRecord,
} from './staff-directory-api.service';
import { StaffForm } from './staff-form';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';import { ColumnConfig } from '../../shared/components/column-config/column-config';import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';import { TablePreferencesService } from '../../core/services/table-preferences.service';
@Component({
  imports: [
    AppActionsMenu,
    EmptyState,
    AppIcon,
    AppModal,
    AppPagination,
    SearchField,
    StatusBadge,
    ClickOutsideDirective,
    StaffForm,
    TableSortHeader,ColumnConfig,
  ],
  templateUrl: './staff-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(StaffDirectoryApiService);
  private confirm = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly auth = inject(AuthStore);
  readonly kind = this.route.snapshot.data['kind'] as StaffKind;
  readonly singular = this.kind === 'doctors' ? 'Doctor' : 'Employee';
  readonly title = this.kind === 'doctors' ? 'Doctors' : 'Employees';
  readonly permission = this.kind;
  readonly items = signal<StaffRecord[]>([]);
  readonly options = signal<StaffOptions>({ departments: [], specializations: [], roles: [] });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly department = signal('');
  readonly specialization = signal('');
  readonly status = signal('');
  readonly filtersOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly modal = signal(false);
  readonly editLoading = signal<string | null>(null);
  readonly editing = signal<StaffRecord | null>(null);
  readonly dirty = signal(false);
  readonly deleting = signal('');
  readonly exporting = signal(false);
  readonly sort=signal<TableSort|null>(null);readonly columns:readonly TableColumnDefinition[]=[{id:'code',header:`${this.singular} ID`,visibleByDefault:true,required:true,sortable:true,sortKey:'employeeCode'},{id:'name',header:this.singular,visibleByDefault:true,required:true,sortable:true,sortKey:'firstName'},{id:'department',header:'Department',visibleByDefault:true,sortable:true,sortKey:'department'},{id:'position',header:this.kind==='doctors'?'Specialization':'Designation',visibleByDefault:true,sortable:true,sortKey:this.kind==='doctors'?'specialization':'designation'},{id:'phone',header:'Phone',visibleByDefault:true,sortable:true,sortKey:'phone'},{id:'email',header:'Email',visibleByDefault:true,sortable:true,sortKey:'email'},{id:'experience',header:this.kind==='doctors'?'Experience':'Joining date',visibleByDefault:true,sortable:true,sortKey:this.kind==='doctors'?'yearsOfExperience':'joiningDate'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];readonly visibleColumns=signal(this.tablePreferences.load(this.kind,this.columns));
  constructor() {
    void this.load();
    void firstValueFrom(this.api.options(this.kind)).then((r) => this.options.set(r.data));
    void this.tablePreferences.loadRemote(this.kind,this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.api.list(this.kind, {
          page: this.page(),
          pageSize: this.pageSize(),
          search: this.search(),
          departmentId: this.department(),
          specializationId: this.specialization(),
          status: this.status(),
          sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
        }),
      );
      this.items.set(r.data);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set(`${this.title} could not be loaded.`);
    } finally {
      this.loading.set(false);
    }
  }
  query(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  apply() {
    this.page.set(1);
    this.filtersOpen.set(false);
    void this.load();
  }
  clear() {
    this.department.set('');
    this.specialization.set('');
    this.status.set('');
    this.apply();
  }
  departmentChanged(v: string) {
    this.department.set(v);
    if (!this.filteredSpecializations().some((x) => x.id === this.specialization()))
      this.specialization.set('');
  }
  filteredSpecializations() {
    return this.options().specializations.filter(
      (x) => !this.department() || x.departmentId === this.department(),
    );
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
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}columnVisible(id:string){return this.visibleColumns().includes(id);}async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save(this.kind,ids);}async resetColumns(){await this.tablePreferences.reset(this.kind);this.visibleColumns.set(this.tablePreferences.load(this.kind,this.columns));}
  async open(item: StaffRecord | null = null) {
    if (item) {
      if (this.editLoading()) return;
      this.editLoading.set(item.id);
      try {
        const response = await firstValueFrom(this.api.get(this.kind, item.id));
        this.editing.set(response.data);
      } catch {
        this.toast.error(`${this.singular} details could not be loaded.`);
        return;
      } finally {
        this.editLoading.set(null);
      }
    } else {
      this.editing.set(null);
    }
    this.dirty.set(false);
    this.modal.set(true);
  }
  view(item: StaffRecord) {
    void this.router.navigate([item.id], { relativeTo: this.route });
  }
  async saved() {
    this.toast.success(`${this.singular} ${this.editing() ? 'updated' : 'created'}.`);
    await this.load();
    this.modal.set(false);
  }
  async remove(item: StaffRecord) {
    if (
      this.deleting() ||
      !(await this.confirm.confirm({
        title: `Delete ${this.singular.toLowerCase()}?`,
        message:
          'The record will be retired while historical hospital relationships remain intact.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    this.deleting.set(item.id);
    try {
      await firstValueFrom(this.api.remove(this.kind, item.id));
      this.toast.success(`${this.singular} deleted.`);
      await this.load();
    } finally {
      this.deleting.set('');
    }
  }
  can(action: 'create' | 'update' | 'delete' | 'export') {
    return this.auth.has(`${this.permission}.${action}` as Permission);
  }
  async export() {
    if (this.exporting() || !this.total()) return;
    this.exporting.set(true);
    try {
      const r = await firstValueFrom(
        this.api.list(this.kind, {
          page: 1,
          pageSize: 100,
          search: this.search(),
          departmentId: this.department(),
          specializationId: this.specialization(),
          status: this.status(),
          sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
        }),
      );
      const exportColumns=[{id:'code',header:'ID',value:(x:StaffRecord)=>x.employeeCode},{id:'name',header:'Name',value:(x:StaffRecord)=>`${x.firstName} ${x.lastName}`},{id:'department',header:'Department',value:(x:StaffRecord)=>x.department?.name??''},{id:'position',header:this.kind==='doctors'?'Specialization':'Designation',value:(x:StaffRecord)=>x.specialization?.name??x.designation??''},{id:'phone',header:'Phone',value:(x:StaffRecord)=>x.phone??''},{id:'email',header:'Email',value:(x:StaffRecord)=>x.email},{id:'experience',header:this.kind==='doctors'?'Experience':'Joining date',value:(x:StaffRecord)=>this.kind==='doctors'?x.yearsOfExperience??0:x.joiningDate??''},{id:'status',header:'Status',value:(x:StaffRecord)=>x.status}].filter(column=>this.columnVisible(column.id));
      const csv=[exportColumns.map(column=>column.header),...r.data.map(item=>exportColumns.map(column=>column.value(item)))].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
}
