import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PatientStore } from '../patient.store';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient } from '../../../shared/models/clinical.models';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { PatientForm } from '../components/patient-form';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { TableSort } from '../../../shared/models/table.models';
import { TableColumnDefinition } from '../../../shared/models/table.models';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
@Component({
  imports: [ReactiveFormsModule, AppIcon, EmptyState, SearchField, AppPagination, PatientForm, AppModal, AppActionsMenu, StatusBadge, ClickOutsideDirective, TableSortHeader, ColumnConfig],
  templateUrl: './patient-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientList implements OnInit {
  readonly store = inject(PatientStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences = inject(TablePreferencesService);
  readonly dates = inject(AppDateTimeService);
  readonly search = signal('');
  readonly columns: readonly TableColumnDefinition[] = [
    {id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'firstName'},
    {id:'mrn',header:'Patient ID',visibleByDefault:true,required:true,sortable:true,sortKey:'mrn'},
    {id:'contact',header:'Contact',visibleByDefault:true},{id:'age',header:'Age',visibleByDefault:true},
    {id:'gender',header:'Gender',visibleByDefault:true},{id:'bloodGroup',header:'Blood group',visibleByDefault:true},
    {id:'status',header:'Status',visibleByDefault:true},{id:'actions',header:'Actions',visibleByDefault:true,required:true},
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('patients', this.columns));
  readonly createOpen = signal(false);
  readonly exporting = signal(false);
  readonly filtersOpen = signal(false);
  readonly editingPatient = signal<Patient | null>(null);
  readonly activeFilterCount = computed(() =>
    [this.store.gender(), this.store.status(), this.store.minAge(), this.store.maxAge(), this.store.createdFrom(), this.store.createdTo()]
      .filter((value) => value !== '' && value !== null).length,
  );
  readonly hasCriteria = computed(() => !!this.search().trim() || this.activeFilterCount() > 0);
  private readonly serverQuery = effect((onCleanup) => {
    const search = this.search();
    const timer = setTimeout(() => {
      this.store.search.set(search);
      this.store.page.set(1);
      void this.store.load();
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });
  readonly filterForm = this.fb.nonNullable.group({
    gender: [''], status: [''], minAge: [null as number | null, [Validators.min(0), Validators.max(130)]],
    maxAge: [null as number | null, [Validators.min(0), Validators.max(130)]], createdFrom: [''], createdTo: [''],
  }, { validators: [(group) => {
    const value = group.getRawValue();
    if (value.minAge != null && value.maxAge != null && value.minAge > value.maxAge) return { ageRange: true };
    if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) return { dateRange: true };
    return null;
  }] });
  async ngOnInit() { this.visibleColumns.set(await this.tablePreferences.loadRemote('patients',this.columns)); }
  age(dob: string) {
    return this.dates.calculateAge(dob);
  }
  open(id: string) {
    void this.router.navigate(['/patients', id]);
  }
  openCreate() {
    this.createOpen.set(true);
  }
  toggleFilters(event: Event) {
    event.stopPropagation();
    this.filtersOpen.update((open) => !open);
  }
  async applyFilters() {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;
    const value = this.filterForm.getRawValue();
    this.store.gender.set(value.gender); this.store.status.set(value.status);
    this.store.minAge.set(value.minAge); this.store.maxAge.set(value.maxAge);
    this.store.createdFrom.set(value.createdFrom); this.store.createdTo.set(value.createdTo);
    this.store.page.set(1); this.filtersOpen.set(false); await this.store.load();
  }
  async clearFilters() {
    this.filterForm.reset({ gender: '', status: '', minAge: null, maxAge: null, createdFrom: '', createdTo: '' });
    this.store.gender.set(''); this.store.status.set(''); this.store.minAge.set(null); this.store.maxAge.set(null);
    this.store.createdFrom.set(''); this.store.createdTo.set(''); this.store.page.set(1); this.filtersOpen.set(false);
    await this.store.load();
  }
  async clearCriteria() {
    this.search.set('');
    this.store.search.set('');
    await this.clearFilters();
  }
  async changePage(page: number) { this.store.page.set(page); await this.store.load(); }
  async changePageSize(pageSize: number) { this.store.pageSize.set(pageSize); this.store.page.set(1); await this.store.load(); }
  async changeSort(sort: TableSort | null) { this.store.sort.set(sort); this.store.page.set(1); await this.store.load(); }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const sort = this.store.sort();
    if (sort?.field !== field) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){
    const activeSort=this.store.sort();
    if(activeSort&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===activeSort.field))this.store.sort.set(null);
    this.visibleColumns.set(ids);await this.tablePreferences.save('patients',ids);
  }
  async resetColumns(){await this.tablePreferences.reset('patients');this.visibleColumns.set(this.tablePreferences.load('patients',this.columns));}
  openEdit(patient: Patient) {
    this.editingPatient.set(patient);
  }
  async onPatientChanged() { await this.store.load(); }
  async deactivate(patient: Patient) {
    const ok = await this.confirmation.confirm({
      title: 'Delete patient?',
      message: 'The patient will be safely removed from new operational workflows while historical hospital records remain intact.',
      context: `${patient.firstName} ${patient.lastName} · ${patient.mrn}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.store.archive(patient.id);
      this.toast.success('Patient deleted successfully.');
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
  async export() {
    if (this.exporting() || this.store.allTotal() === 0) return;
    this.exporting.set(true);
    try {
    const rows = [
      ['MRN', 'Name', 'Phone', 'Status'],
      ...this.store.patients().map((p) => [p.mrn, `${p.firstName} ${p.lastName}`, p.phone, p.status]),
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'patients.csv';
    a.click();
    URL.revokeObjectURL(url);
    } finally { this.exporting.set(false); }
  }
}
