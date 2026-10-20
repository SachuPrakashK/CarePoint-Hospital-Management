import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { SearchField } from '../../../shared/components/search/search-field';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
import { SharedExport } from '../../../shared/components/export/shared-export';
import { ProcedureStore } from '../procedure.store';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';

@Component({
  imports: [
    ReactiveFormsModule,
    SearchField,
    StatusBadge,
    EmptyState,
    AppPagination,
    AppActionsMenu,
    AppModal,
    SharedFilter,
    SharedExport,
    TableSortHeader,
    ColumnConfig,
    SummaryCard,
  ],
  templateUrl: './procedure-page.html',
  styleUrl: './procedure-page.scss',
})
export class ProcedurePage {
  readonly store = inject(ProcedureStore);
  readonly clinical = inject(ClinicalStore);
  readonly auth = inject(AuthStore);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private dates = inject(AppDateTimeService);
  private toast = inject(ToastService);
  private tablePreferences = inject(TablePreferencesService);
  readonly search = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly theatreId = signal('');
  readonly status = signal('');
  readonly draftFromDate = signal('');
  readonly draftToDate = signal('');
  readonly draftTheatreId = signal('');
  readonly draftStatus = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly exporting = signal(false);
  readonly sort = signal<TableSort | null>(null);
  readonly columns: readonly TableColumnDefinition[] = [
    {
      id: 'date',
      header: 'Date/time',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'scheduledAt',
    },
    {
      id: 'patient',
      header: 'Patient',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'patient',
    },
    {
      id: 'procedure',
      header: 'Procedure',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'name',
    },
    { id: 'surgeon', header: 'Surgeon', visibleByDefault: true, sortable: true, sortKey: 'doctor' },
    {
      id: 'theatre',
      header: 'Theatre',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'theatre',
    },
    {
      id: 'duration',
      header: 'Duration',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'durationMinutes',
    },
    { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
    { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('procedures', this.columns));
  readonly formOpen = signal(false);
  readonly editing = signal<any | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal('');
  readonly activeFilterCount = computed(
    () => [this.fromDate(), this.toDate(), this.theatreId(), this.status()].filter(Boolean).length,
  );
  readonly hasCriteria = computed(() => !!this.search().trim() || this.activeFilterCount() > 0);
  readonly canCreate = computed(() => this.auth.has('procedures.create'));
  readonly canEdit = computed(() => this.auth.has('procedures.edit'));
  readonly form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    admissionId: [''],
    doctorId: ['', Validators.required],
    theatreId: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    scheduledAt: ['', Validators.required],
    durationMinutes: [60, [Validators.required, Validators.min(1)]],
    indication: ['', Validators.required],
    notes: [''],
    status: ['Scheduled', Validators.required],
  });
  constructor() {
    void this.clinical.load();
    void this.store.initialize(this.query());
    void this.tablePreferences
      .loadRemote('procedures', this.columns)
      .then((ids) => this.visibleColumns.set(ids));
  }
  query() {
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      theatreId: this.theatreId(),
      status: this.status(),
      sortBy: this.sort()?.field,
      sortOrder: this.sort()?.direction,
    };
  }
  load() {
    return this.store.load(this.query());
  }
  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.load();
  }
  applyFilters() {
    if (this.draftFromDate() && this.draftToDate() && this.draftFromDate() > this.draftToDate())
      return;
    this.fromDate.set(this.draftFromDate());
    this.toDate.set(this.draftToDate());
    this.theatreId.set(this.draftTheatreId());
    this.status.set(this.draftStatus());
    this.page.set(1);
    void this.load();
  }
  clearFilters() {
    this.draftFromDate.set('');
    this.draftToDate.set('');
    this.draftTheatreId.set('');
    this.draftStatus.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.theatreId.set('');
    this.status.set('');
    this.page.set(1);
    void this.load();
  }
  clearCriteria() {
    this.search.set('');
    this.clearFilters();
  }
  changePage(value: number) {
    this.page.set(value);
    void this.load();
  }
  changePageSize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
    void this.load();
  }
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.load();
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
      this.sort.set(null);
    this.visibleColumns.set(ids);
    await this.tablePreferences.save('procedures', ids);
  }
  async resetColumns() {
    await this.tablePreferences.reset('procedures');
    this.visibleColumns.set(this.tablePreferences.load('procedures', this.columns));
  }
  format(value: string) {
    return this.dates.formatDateTime(value);
  }
  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({
      patientId: '',
      admissionId: '',
      doctorId: '',
      theatreId: '',
      name: '',
      scheduledAt: this.dates.formDateTime(new Date(Date.now() + 86400000)),
      durationMinutes: 60,
      indication: '',
      notes: '',
      status: 'Scheduled',
    });
    this.formOpen.set(true);
  }
  openEdit(item: any) {
    this.editing.set(item);
    this.formError.set('');
    this.form.reset({
      patientId: item.patientId,
      admissionId: item.admissionId ?? '',
      doctorId: item.doctorId,
      theatreId: item.theatreId ?? '',
      name: item.name,
      scheduledAt: this.dates.formDateTime(new Date(item.scheduledAt)),
      durationMinutes: item.durationMinutes,
      indication: item.indication,
      notes: item.notes ?? '',
      status: item.status,
    });
    this.formOpen.set(true);
  }
  closeForm() {
    if (!this.submitting()) this.formOpen.set(false);
  }
  admissionsForPatient() {
    return this.store
      .lookups()
      .admissions.filter((item: any) => item.patientId === this.form.controls.patientId.value);
  }
  showAdmissionField() {
    return this.admissionsForPatient().length > 0;
  }
  onPatientChange() {
    this.form.controls.admissionId.setValue('');
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.formError.set('');
    try {
      const value = this.form.getRawValue();
      await this.store.save(
        {
          ...value,
          admissionId: value.admissionId || null,
          scheduledAt: this.dates.formDateTimeToApi(value.scheduledAt),
          durationMinutes: Number(value.durationMinutes),
          team: [],
          preOpChecklist: [],
        },
        this.editing()?.id,
      );
      this.formOpen.set(false);
      await this.load();
      this.toast.success(this.editing() ? 'Procedure updated.' : 'Procedure scheduled.');
    } catch (error: any) {
      this.formError.set(error?.error?.message ?? 'The procedure could not be saved.');
    } finally {
      this.submitting.set(false);
    }
  }
  view(id: string) {
    void this.router.navigate(['/procedures', id]);
  }
  nextStatus(item: any) {
    return item.status === 'Planned'
      ? 'Scheduled'
      : item.status === 'Scheduled'
        ? 'In Progress'
        : item.status === 'In Progress'
          ? 'Completed'
          : '';
  }
  async advance(item: any) {
    const status = this.nextStatus(item);
    if (!status) return;
    try {
      await this.store.transition(item.id, status);
      await this.load();
      this.toast.success(`Procedure marked ${status.toLowerCase()}.`);
    } catch (error: any) {
      this.toast.error(error?.error?.message ?? 'Status could not be updated.');
    }
  }
  export() {
    if (this.exporting() || !this.store.records().length) return;
    this.exporting.set(true);
    try {
      const exportColumns = [
        { id: 'date', header: 'Date/time', value: (item: any) => item.scheduledAt },
        {
          id: 'patient',
          header: 'Patient',
          value: (item: any) => `${item.patientName} (${item.mrn})`,
        },
        { id: 'procedure', header: 'Procedure', value: (item: any) => item.name },
        { id: 'surgeon', header: 'Surgeon', value: (item: any) => item.doctorName },
        { id: 'theatre', header: 'Theatre', value: (item: any) => item.theatreName },
        { id: 'duration', header: 'Duration', value: (item: any) => item.durationMinutes },
        { id: 'status', header: 'Status', value: (item: any) => item.status },
      ].filter((column) => this.columnVisible(column.id));
      const rows = [
        exportColumns.map((column) => column.header),
        ...this.store.records().map((item) => exportColumns.map((column) => column.value(item))),
      ];
      const blob = new Blob(
        [
          rows
            .map((row) =>
              row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','),
            )
            .join('\r\n'),
        ],
        { type: 'text/csv' },
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'procedures.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      this.exporting.set(false);
    }
  }
}
