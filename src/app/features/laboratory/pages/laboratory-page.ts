import { Component, inject, signal } from '@angular/core';
import { Phase23Store } from '../../../core/services/phase23.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { LaboratoryForm } from './laboratory-form';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { PatientStore } from '../../patients/patient.store';
import { AppointmentApiService } from '../../appointments/appointment-api.service';
import { MasterApiService } from '../../administration/master-api.service';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { TableSort } from '../../../shared/models/table.models';
import { TableColumnDefinition } from '../../../shared/models/table.models';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
@Component({
  imports: [AppModal, LaboratoryForm, RouterLink, SearchField, AppPagination, EmptyState, StatusBadge, AppActionsMenu, AppIcon, ClickOutsideDirective,TableSortHeader,ColumnConfig],
  templateUrl: './laboratory-page.html',
})
export class LaboratoryPage {
  readonly store = inject(Phase23Store);
  private api = inject(Phase23ApiService);
  private router = inject(Router);
  readonly auth = inject(AuthStore);
  readonly patients = inject(PatientStore);
  private appointmentsApi = inject(AppointmentApiService);
  private mastersApi = inject(MasterApiService);
  private tablePreferences=inject(TablePreferencesService);
  readonly message = signal('');
  readonly formMode = signal<'create' | 'edit' | 'result' | null>(null);
  readonly selected = signal<any | null>(null);
  readonly dirty = signal(false);
  readonly items = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly search = signal('');
  readonly status = signal('');
  readonly priority = signal('');
  readonly patientId = signal('');
  readonly doctorId = signal('');
  readonly testDefinitionId = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly filtersOpen = signal(false);
  readonly doctors = signal<any[]>([]);
  readonly tests = signal<any[]>([]);
  readonly exporting = signal(false);
  readonly mutatingId = signal('');
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'order',header:'Order',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},{id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'patient'},{id:'tests',header:'Tests',visibleByDefault:true},{id:'priority',header:'Priority',visibleByDefault:true,sortable:true,sortKey:'priority'},{id:'sample',header:'Sample',visibleByDefault:true,sortable:true,sortKey:'sampleType'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'action',header:'Action',visibleByDefault:true,required:true}];
  readonly visibleColumns=signal(this.tablePreferences.load('laboratory-orders',this.columns));
  constructor() {
    void this.patients.load();
    void firstValueFrom(this.appointmentsApi.options()).then((r) => this.doctors.set(r.data.doctors));
    void firstValueFrom(this.mastersApi.list('laboratory-tests', '', 'Active', 1, 100)).then((r) => this.tests.set(r.data));
    void this.load();
    void this.tablePreferences.loadRemote('laboratory-orders',this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.api.labOrders({
          page: this.page(),
          page_size: this.pageSize(),
          search: this.search(),
          status: this.status(),
          priority: this.priority(),
          patient_id: this.patientId(), doctor_id: this.doctorId(), test_definition_id: this.testDefinitionId(),
          date_from: this.dateFrom(), date_to: this.dateTo(),
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
      this.error.set('Laboratory orders could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  count(s: string) {
    return this.items().filter((o) => o.status === s).length;
  }
  searchChanged(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  filter() {
    this.page.set(1);
    this.filtersOpen.set(false);
    void this.load();
  }
  clearFilters() { this.status.set(''); this.priority.set(''); this.patientId.set(''); this.doctorId.set(''); this.testDefinitionId.set(''); this.dateFrom.set(''); this.dateTo.set(''); this.filter(); }
  activeFilterCount() { return [this.status(), this.priority(), this.patientId(), this.doctorId(), this.testDefinitionId(), this.dateFrom(), this.dateTo()].filter(Boolean).length; }
  async exportOrders() {
    if (this.exporting() || !this.total()) return;
    this.exporting.set(true);
    try {
      const query = { page_size: 100, search: this.search(), status: this.status(), priority: this.priority(), patient_id: this.patientId(), doctor_id: this.doctorId(), test_definition_id: this.testDefinitionId(), date_from: this.dateFrom(), date_to: this.dateTo(),sort_by:this.sort()?.field,sort_order:this.sort()?.direction };
      const first = await firstValueFrom(this.api.labOrders({ ...query, page: 1 }));
      const rows = [...first.data];
      for (let page = 2; page <= first.pagination.total_pages; page++) rows.push(...(await firstValueFrom(this.api.labOrders({ ...query, page }))).data);
      const quote = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
      const exportColumns=[{id:'order',header:'Order',value:(o:any)=>`${o.number} / ${o.doctor}`},{id:'patient',header:'Patient',value:(o:any)=>`${o.patient?.firstName??''} ${o.patient?.lastName??''}`.trim()},{id:'tests',header:'Tests',value:(o:any)=>o.tests?.join(', ')},{id:'priority',header:'Priority',value:(o:any)=>o.priority},{id:'sample',header:'Sample',value:(o:any)=>o.sampleType},{id:'status',header:'Status',value:(o:any)=>o.status}].filter(column=>this.columnVisible(column.id));
      const csv = [exportColumns.map(column=>column.header), ...rows.map((o:any) => exportColumns.map(column=>column.value(o)))].map((row) => row.map(quote).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'laboratory-orders.csv'; link.click(); URL.revokeObjectURL(url);
    } finally { this.exporting.set(false); }
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
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('laboratory-orders',ids);}
  async resetColumns(){await this.tablePreferences.reset('laboratory-orders');this.visibleColumns.set(this.tablePreferences.load('laboratory-orders',this.columns));}
  open(mode: 'create' | 'edit' | 'result', order: any = null) {
    this.formMode.set(mode);
    this.selected.set(order);
    this.dirty.set(false);
  }
  close() {
    this.formMode.set(null);
    this.selected.set(null);
  }
  async saved() {
    this.message.set(
      this.formMode() === 'create'
        ? 'Laboratory order created.'
        : this.formMode() === 'edit'
          ? 'Laboratory order updated.'
          : 'Result saved. Verification is now required.',
    );
    await this.load();
  }
  async collect(id: string) {
    if (this.mutatingId()) return;
    this.mutatingId.set(id);
    try {
    await this.store.collectSample(id, 'Current user');
    await this.load();
    } finally { this.mutatingId.set(''); }
  }
  async verify(id: string) {
    if (this.mutatingId()) return;
    this.mutatingId.set(id);
    try {
    await this.store.verifyLab(id, 'Current user');
    await this.load();
    } finally { this.mutatingId.set(''); }
  }
  view(id: string) {
    void this.router.navigate(['/laboratory', id]);
  }
  workflowLabel(order: any) {
    return order.status === 'Ordered'
      ? 'Collect sample'
      : order.status === 'Result Entered'
        ? 'Verify result'
        : 'Enter result';
  }
  async workflow(order: any) {
    if (order.status === 'Ordered') await this.collect(order.id);
    else if (order.status === 'Result Entered') await this.verify(order.id);
    else this.open('result', order);
  }
}
