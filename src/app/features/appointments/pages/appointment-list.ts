import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiAppointment, AppointmentApiService, AppointmentOptions } from '../appointment-api.service';
import { AppointmentInvalidationService } from '../appointment-invalidation.service';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppointmentForm } from './appointment-form';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
import { SharedExport } from '../../../shared/components/export/shared-export';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';

const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const sundayOf = (key: string) => {
  const date = new Date(`${key}T00:00:00Z`);
  return addDays(key, -date.getUTCDay());
};

@Component({
  imports: [AppointmentForm, AppModal, SearchField, AppActionsMenu, AppPagination, EmptyState, AppIcon, StatusBadge, SharedFilter, SharedExport, TableSortHeader, ColumnConfig],
  templateUrl: './appointment-list.html',
  styleUrl: './appointment-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentList {
  private readonly api = inject(AppointmentApiService);
  private readonly invalidation = inject(AppointmentInvalidationService);
  private readonly notifications = inject(NotificationStore);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly tablePreferences=inject(TablePreferencesService);
  readonly dates = inject(AppDateTimeService);

  readonly appointments = signal<ApiAppointment[]>([]);
  readonly calendarAppointments = signal<ApiAppointment[]>([]);
  readonly options = signal<AppointmentOptions>({ patients: [], departments: [], doctors: [] });
  readonly loading = signal(true);
  readonly calendarLoading = signal(false);
  readonly error = signal('');
  readonly statusTarget = signal<ApiAppointment | null>(null);
  readonly newStatus = signal('');
  readonly statusUpdating = signal(false);
  readonly exporting = signal(false);
  readonly search = signal('');
  readonly departmentId = signal('');
  readonly doctorId = signal('');
  readonly status = signal('');
  readonly draftDepartmentId = signal('');
  readonly draftDoctorId = signal('');
  readonly draftStatus = signal('');
  readonly view = signal<'list' | 'calendar'>('list');
  readonly createOpen = signal(false);
  readonly editing = signal<ApiAppointment | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[
    {id:'date',header:'Date & time',visibleByDefault:true,required:true,sortable:true,sortKey:'appointmentAt'},
    {id:'number',header:'Appointment',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},
    {id:'patient',header:'Patient',visibleByDefault:true,sortable:true,sortKey:'patient'},
    {id:'care',header:'Department / Doctor',visibleByDefault:true,sortable:true,sortKey:'department'},
    {id:'type',header:'Type',visibleByDefault:true,sortable:true,sortKey:'type'},
    {id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},
    {id:'actions',header:'Actions',visibleByDefault:true,required:true},
  ];
  readonly visibleColumns=signal(this.tablePreferences.load('appointments',this.columns));
  readonly weekStart = signal(sundayOf(this.dates.today()));
  readonly activeFilterCount = computed(() => [this.departmentId(), this.doctorId(), this.status()].filter(Boolean).length);
  readonly hasCriteria = computed(() => Boolean(this.search().trim()) || this.activeFilterCount() > 0);
  readonly filteredDoctors = computed(() => this.options().doctors.filter((doctor) => !this.draftDepartmentId() || doctor.departmentId === this.draftDepartmentId()));
  readonly weekDays = computed(() => Array.from({ length: 7 }, (_, index) => {
    const key = addDays(this.weekStart(), index);
    const date = new Date(`${key}T00:00:00Z`);
    return { key, day: new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(date), date: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date) };
  }));
  readonly weekLabel = computed(() => {
    const start = new Date(`${this.weekStart()}T00:00:00Z`);
    const end = new Date(`${addDays(this.weekStart(), 6)}T00:00:00Z`);
    const format = (date: Date) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
    return `${format(start)} – ${format(end)}`;
  });

  constructor() {
    void Promise.all([this.load(), this.loadOptions()]);
    void this.tablePreferences.loadRemote('appointments',this.columns).then(ids=>this.visibleColumns.set(ids));
    this.invalidation.changed.subscribe((domains) => {
      if (domains.has('appointment')) void this.refreshVisibleData();
    });
  }

  async load() {
    this.loading.set(true); this.error.set('');
    try {
      const response = await firstValueFrom(this.api.list({ page: this.page(), pageSize: this.pageSize(), search: this.search(), departmentId: this.departmentId(), doctorId: this.doctorId(), status: this.status(),sortBy:this.sort()?.field,sortOrder:this.sort()?.direction }));
      this.appointments.set(response.data); this.total.set(response.pagination.total); this.totalPages.set(response.pagination.total_pages);
    } catch { this.error.set('Unable to load appointments.'); }
    finally { this.loading.set(false); }
  }
  async loadOptions() {
    try { this.options.set((await firstValueFrom(this.api.options())).data); }
    catch { this.error.set('Appointment filters could not be loaded.'); }
  }
  async loadCalendar() {
    this.calendarLoading.set(true); this.error.set('');
    try {
      const end = addDays(this.weekStart(), 7);
      const response = await firstValueFrom(this.api.list({ page: 1, pageSize: 250, startDate: this.dates.formValueToApi(this.weekStart(), '00:00'), endDate: this.dates.formValueToApi(end, '00:00'), sortOrder: 'asc' }));
      this.calendarAppointments.set(response.data);
    } catch { this.error.set('Unable to load the appointment calendar.'); }
    finally { this.calendarLoading.set(false); }
  }
  async refreshVisibleData() { await this.load(); if (this.view() === 'calendar') await this.loadCalendar(); }
  date(item: ApiAppointment) { return this.dates.formatDate(item.appointmentAt); }
  time(item: ApiAppointment) { return this.dates.formatTime(item.appointmentAt); }
  appointmentsForDay(key: string) { return this.calendarAppointments().filter((item) => this.dates.dateKey(item.appointmentAt) === key); }
  viewAppointment(item: ApiAppointment) { void this.router.navigate(['/appointments', item.id]); }
  async setView(view: 'list' | 'calendar') { this.view.set(view); if (view === 'calendar') await this.loadCalendar(); }
  onSearch(value: string) { this.search.set(value); this.page.set(1); void this.load(); }
  departmentChanged(value: string) {
    this.draftDepartmentId.set(value);
    const doctor = this.options().doctors.find((item) => item.id === this.draftDoctorId());
    if (doctor && doctor.departmentId !== value) this.draftDoctorId.set('');
  }
  async applyFilters() {
    this.departmentId.set(this.draftDepartmentId()); this.doctorId.set(this.draftDoctorId()); this.status.set(this.draftStatus());
    this.page.set(1); await this.load();
  }
  async clearFilters() {
    this.draftDepartmentId.set(''); this.draftDoctorId.set(''); this.draftStatus.set('');
    this.departmentId.set(''); this.doctorId.set(''); this.status.set(''); this.page.set(1); await this.load();
  }
  async clearCriteria() { this.search.set(''); await this.clearFilters(); }
  async changePage(page: number) { this.page.set(page); await this.load(); }
  async changePageSize(pageSize: number) { this.pageSize.set(pageSize); this.page.set(1); await this.load(); }
  async changeSort(sort:TableSort|null){this.sort.set(sort);this.page.set(1);await this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('appointments',ids);}
  async resetColumns(){await this.tablePreferences.reset('appointments');this.visibleColumns.set(this.tablePreferences.load('appointments',this.columns));}
  async shiftWeek(days: number) { this.weekStart.set(addDays(this.weekStart(), days)); await this.loadCalendar(); }
  async currentWeek() { this.weekStart.set(sundayOf(this.dates.today())); await this.loadCalendar(); }
  async saved() { this.createOpen.set(false); this.editing.set(null); this.view.set('list'); await this.refreshVisibleData(); void this.router.navigate(['/appointments']); }
  async cancel(item: ApiAppointment) {
    if (!await this.confirmation.confirm({ title: 'Cancel appointment?', message: 'This appointment will be marked as cancelled.', context: `${item.number} · ${item.patientName}`, confirmLabel: 'Cancel appointment', danger: true })) return;
    try { await firstValueFrom(this.api.status(item.id, 'CANCELLED')); this.toast.success('Appointment cancelled.'); this.invalidation.notify(); void this.notifications.load(); await this.refreshVisibleData(); }
    catch { this.toast.error('Appointment could not be cancelled.'); }
  }
  allowedStatuses(item: ApiAppointment) {
    const transitions: Record<string, string[]> = { SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'], CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'], CHECKED_IN: ['WAITING', 'IN_CONSULTATION', 'CANCELLED'], WAITING: ['IN_CONSULTATION', 'CANCELLED', 'NO_SHOW'], IN_CONSULTATION: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [], NO_SHOW: [] };
    return transitions[item.status] ?? [];
  }
  openStatus(item: ApiAppointment) { this.statusTarget.set(item); this.newStatus.set(''); }
  async updateStatus() {
    const item = this.statusTarget(), status = this.newStatus();
    if (!item || !status || this.statusUpdating()) return;
    this.statusUpdating.set(true);
    try {
      await firstValueFrom(this.api.status(item.id, status));
      this.toast.success('Appointment status updated.'); this.statusTarget.set(null);
      this.invalidation.notify(); void this.notifications.load(); await this.refreshVisibleData();
    } catch { this.toast.error('Appointment status could not be updated.'); }
    finally { this.statusUpdating.set(false); }
  }
  async export() {
    if (this.exporting() || this.total() === 0) return;
    this.exporting.set(true);
    try {
    const rows = [['Appointment', 'Patient', 'Department', 'Doctor', 'Date', 'Status'], ...this.appointments().map((item) => [item.number, item.patientName, item.department, item.doctor, this.dates.formatDateTime(item.appointmentAt), item.status])];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = 'appointments.csv'; link.click(); URL.revokeObjectURL(url);
    } finally { this.exporting.set(false); }
  }
}
