import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { OpdQueueApiService, OpdQueueItem } from '../opd-queue-api.service';
import { AppointmentApiService, AppointmentOptions } from '../../appointments/appointment-api.service';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { DashboardInvalidationService } from '../../../core/services/dashboard-invalidation.service';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';import { ColumnConfig } from '../../../shared/components/column-config/column-config';import { TableColumnDefinition,TableSort } from '../../../shared/models/table.models';import { TablePreferencesService } from '../../../core/services/table-preferences.service';
@Component({
  imports: [RouterLink, DatePipe, SearchField, AppPagination, AppActionsMenu, EmptyState, AppIcon, StatusBadge, ClickOutsideDirective,TableSortHeader,ColumnConfig],
  templateUrl: './queue-page.html', styleUrl: './queue-page.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueuePage {
  private readonly api = inject(OpdQueueApiService); private readonly appointmentApi = inject(AppointmentApiService);
  private readonly router = inject(Router); private readonly toast = inject(ToastService); private readonly invalidation = inject(DashboardInvalidationService);
  private readonly tablePreferences=inject(TablePreferencesService);
  readonly dates = inject(AppDateTimeService); readonly items = signal<OpdQueueItem[]>([]);
  readonly options = signal<AppointmentOptions>({ patients: [], departments: [], doctors: [] });
  readonly loading = signal(true); readonly error = signal(''); readonly search = signal(''); readonly page = signal(1); readonly pageSize = signal(10); readonly total = signal(0); readonly totalPages = signal(0);
  readonly filtersOpen = signal(false); readonly departmentId = signal(''); readonly doctorId = signal(''); readonly status = signal(''); readonly date = signal(this.dates.today());
  readonly draftDepartmentId = signal(''); readonly draftDoctorId = signal(''); readonly draftStatus = signal(''); readonly draftDate = signal(this.dates.today()); readonly exporting = signal(false); readonly mutatingId = signal('');
  readonly sort=signal<TableSort|null>(null);readonly columns:readonly TableColumnDefinition[]=[{id:'token',header:'Token',visibleByDefault:true,required:true,sortable:true,sortKey:'tokenNumber'},{id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'patient'},{id:'care',header:'Doctor / Department',visibleByDefault:true,sortable:true,sortKey:'doctor'},{id:'appointment',header:'Appointment',visibleByDefault:true,sortable:true,sortKey:'appointment'},{id:'checkin',header:'Checked in',visibleByDefault:true,sortable:true,sortKey:'checkedInAt'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];readonly visibleColumns=signal(this.tablePreferences.load('opd-queue',this.columns));
  readonly filteredDoctors = computed(() => this.options().doctors.filter((doctor) => !this.draftDepartmentId() || doctor.departmentId === this.draftDepartmentId()));
  readonly activeFilterCount = computed(() => [this.departmentId(), this.doctorId(), this.status()].filter(Boolean).length + (this.date() !== this.dates.today() ? 1 : 0));
  readonly hasCriteria = computed(() => Boolean(this.search()) || this.activeFilterCount() > 0);
  readonly counts = computed(() => Object.fromEntries(['WAITING','CALLED','IN_CONSULTATION','COMPLETED'].map((status) => [status, this.items().filter((item) => item.status === status).length])));
  constructor() { void Promise.all([this.load(), this.loadOptions()]);void this.tablePreferences.loadRemote('opd-queue',this.columns).then(ids=>this.visibleColumns.set(ids)); }
  async loadOptions() { try { this.options.set((await firstValueFrom(this.appointmentApi.options())).data); } catch { this.error.set('Queue filters could not be loaded.'); } }
  async load() { if (this.loading() && this.items().length) return; this.loading.set(true); this.error.set(''); try { const response = await firstValueFrom(this.api.list({ page: this.page(), pageSize: this.pageSize(), search: this.search(), departmentId: this.departmentId(), doctorId: this.doctorId(), status: this.status(), date: this.date(),sortBy:this.sort()?.field,sortOrder:this.sort()?.direction })); this.items.set(response.data); this.total.set(response.pagination.total); this.totalPages.set(response.pagination.total_pages); } catch { this.error.set('Unable to load the OPD queue.'); } finally { this.loading.set(false); } }
  searchChanged(value: string) { this.search.set(value); this.page.set(1); void this.load(); }
  departmentChanged(value: string) { this.draftDepartmentId.set(value); const selected = this.options().doctors.find((doctor) => doctor.id === this.draftDoctorId()); if (selected && selected.departmentId !== value) this.draftDoctorId.set(''); }
  async applyFilters() { this.departmentId.set(this.draftDepartmentId()); this.doctorId.set(this.draftDoctorId()); this.status.set(this.draftStatus()); this.date.set(this.draftDate()); this.page.set(1); this.filtersOpen.set(false); await this.load(); }
  async clearFilters() { this.draftDepartmentId.set(''); this.draftDoctorId.set(''); this.draftStatus.set(''); this.draftDate.set(this.dates.today()); this.departmentId.set(''); this.doctorId.set(''); this.status.set(''); this.date.set(this.dates.today()); this.page.set(1); this.filtersOpen.set(false); await this.load(); }
  async clearCriteria() { this.search.set(''); await this.clearFilters(); }
  async changePage(page: number) { this.page.set(page); await this.load(); } async changePageSize(size: number) { this.pageSize.set(size); this.page.set(1); await this.load(); }
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}columnVisible(id:string){return this.visibleColumns().includes(id);}async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('opd-queue',ids);}async resetColumns(){await this.tablePreferences.reset('opd-queue');this.visibleColumns.set(this.tablePreferences.load('opd-queue',this.columns));}
  view(item: OpdQueueItem) { void this.router.navigate(['/appointments', item.appointmentId]); }
  nextStatus(item: OpdQueueItem) { return ({ WAITING: 'CALLED', CALLED: 'IN_CONSULTATION', IN_CONSULTATION: 'COMPLETED' } as Record<string,string>)[item.status] ?? ''; }
  async advance(item: OpdQueueItem) { const next = this.nextStatus(item); if (!next || this.mutatingId()) return; this.mutatingId.set(item.id); try { await firstValueFrom(this.api.status(item.id, next)); this.toast.success('Queue status updated.'); this.invalidation.invalidate('appointment'); await this.load(); } catch { this.toast.error('Queue status could not be updated.'); } finally { this.mutatingId.set(''); } }
  async export() { if (this.exporting() || !this.items().length) return; this.exporting.set(true); try { const exportColumns=[{id:'token',header:'Token',value:(item:OpdQueueItem)=>item.token},{id:'patient',header:'Patient',value:(item:OpdQueueItem)=>`${item.patientName} / ${item.mrn}`},{id:'care',header:'Doctor / Department',value:(item:OpdQueueItem)=>`${item.doctor} / ${item.department}`},{id:'appointment',header:'Appointment',value:(item:OpdQueueItem)=>item.appointmentNumber},{id:'checkin',header:'Checked in',value:(item:OpdQueueItem)=>item.checkedInAt},{id:'status',header:'Status',value:(item:OpdQueueItem)=>item.status}].filter(column=>this.columnVisible(column.id));const rows=[exportColumns.map(column=>column.header),...this.items().map(item=>exportColumns.map(column=>column.value(item)))]; const blob = new Blob([rows.map((row) => row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href=url; link.download='opd-queue.csv'; link.click(); URL.revokeObjectURL(url); } finally { this.exporting.set(false); } }
}
