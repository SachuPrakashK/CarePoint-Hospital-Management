import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SearchField } from '../../../shared/components/search/search-field';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';

@Component({
  imports: [
    RouterLink,
    ReactiveFormsModule,
    StatusBadge,
    SearchField,
    AppPagination,
    EmptyState,
    AppIcon,
    AppModal,
    ClickOutsideDirective,
    TableSortHeader,ColumnConfig,
  ],
  templateUrl: './inpatient-page.html',
  styleUrl: './inpatient-page.scss',
})
export class InpatientPage {
  readonly store = inject(InpatientStore);
  readonly auth = inject(AuthStore);
  private clinical = inject(ClinicalStore);
  private dates = inject(AppDateTimeService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly tab = signal<'admissions' | 'beds' | 'wards'>('admissions');
  readonly search = signal('');
  readonly departmentId = signal('');
  readonly status = signal('');
  readonly draftDepartmentId = signal('');
  readonly draftStatus = signal('');
  readonly filtersOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly exporting = signal(false);
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'admission',header:'Admission',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},{id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'patient'},{id:'care',header:'Department / Doctor',visibleByDefault:true,sortable:true,sortKey:'department'},{id:'bed',header:'Ward / Room / Bed',visibleByDefault:true},{id:'admitted',header:'Admitted',visibleByDefault:true,sortable:true,sortKey:'admittedAt'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'}];
  readonly visibleColumns=signal(this.tablePreferences.load('admissions',this.columns));
  constructor(){void this.tablePreferences.loadRemote('admissions',this.columns).then(ids=>this.visibleColumns.set(ids));}
  readonly wardOpen = signal(false);
  readonly wardSubmitting = signal(false);
  readonly wardError = signal('');
  readonly activeFilterCount = computed(
    () => [this.departmentId(), this.status()].filter(Boolean).length,
  );
  readonly hasCriteria = computed(
    () => Boolean(this.search().trim()) || this.activeFilterCount() > 0,
  );
  readonly wardForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    floor: ['', [Validators.required, Validators.maxLength(50)]],
    status: ['Active', Validators.required],
  });
  occupancy() {
    const total = this.store.beds().length;
    return total ? Math.round((this.store.occupiedBeds().length / total) * 100) : 0;
  }
  bedWards() {
    return [...new Set(this.store.beds().map((bed) => bed.ward))];
  }
  beds(ward: string) {
    return this.store.beds().filter((bed) => bed.ward === ward);
  }
  available(ward: string) {
    return this.beds(ward).filter((bed) => bed.status === 'Available').length;
  }
  wardBedCount(ward: any) {
    return (ward.rooms ?? []).reduce(
      (total: number, room: any) => total + (room.beds?.length ?? 0),
      0,
    );
  }
  patientName(id: string) {
    const patient = this.clinical.patients().find((item) => item.id === id);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Not available';
  }
  patientMrn(id: string) {
    return this.clinical.patients().find((item) => item.id === id)?.mrn ?? 'Not available';
  }
  activeAllocation(admission: any) {
    return (
      admission.allocations.find((allocation: any) => !allocation.endedAt) ??
      admission.allocations.at(-1)
    );
  }
  format(value: string) {
    return this.dates.formatDateTime(value);
  }
  async loadAdmissions() {
    await this.store.loadAdmissions({
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      departmentId: this.departmentId(),
      status: this.status(),
      sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
    });
  }
  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.loadAdmissions();
  }
  async applyFilters() {
    this.departmentId.set(this.draftDepartmentId());
    this.status.set(this.draftStatus());
    this.page.set(1);
    this.filtersOpen.set(false);
    await this.loadAdmissions();
  }
  async clearFilters() {
    this.draftDepartmentId.set('');
    this.draftStatus.set('');
    this.departmentId.set('');
    this.status.set('');
    this.page.set(1);
    this.filtersOpen.set(false);
    await this.loadAdmissions();
  }
  async clearCriteria() {
    this.search.set('');
    await this.clearFilters();
  }
  async changePage(page: number) {
    this.page.set(page);
    await this.loadAdmissions();
  }
  async changePageSize(pageSize: number) {
    this.pageSize.set(pageSize);
    this.page.set(1);
    await this.loadAdmissions();
  }
  async changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);await this.loadAdmissions();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('admissions',ids);}
  async resetColumns(){await this.tablePreferences.reset('admissions');this.visibleColumns.set(this.tablePreferences.load('admissions',this.columns));}
  viewAdmission(id: string) {
    void this.router.navigate(['/inpatient', id]);
  }
  export() {
    if (this.exporting() || !this.store.admissions().length) return;
    this.exporting.set(true);
    try {
      const exportColumns=[{id:'admission',header:'Admission',value:(item:any)=>item.number},{id:'patient',header:'Patient',value:(item:any)=>item.patientName},{id:'care',header:'Department / Doctor',value:(item:any)=>`${item.department??''} / ${item.attendingDoctor??''}`},{id:'bed',header:'Ward / Room / Bed',value:(item:any)=>{const allocation=this.activeAllocation(item);return `${allocation?.ward??''} / ${allocation?.room??''} / ${allocation?.bedName??''}`;}},{id:'admitted',header:'Admitted',value:(item:any)=>item.admittedAt},{id:'status',header:'Status',value:(item:any)=>item.status}].filter(column=>this.columnVisible(column.id));
      const rows=[exportColumns.map(column=>column.header),...this.store.admissions().map(item=>exportColumns.map(column=>column.value(item)))];
      const blob = new Blob(
        [
          rows
            .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
            .join('\n'),
        ],
        { type: 'text/csv' },
      );
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'admissions.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
  openWard() {
    this.wardForm.reset({ code: '', name: '', floor: '', status: 'Active' });
    this.wardForm.markAsPristine();
    this.wardError.set('');
    this.wardOpen.set(true);
  }
  async createWard() {
    this.wardForm.markAllAsTouched();
    if (this.wardForm.invalid || this.wardSubmitting()) return;
    this.wardSubmitting.set(true);
    this.wardError.set('');
    try {
      await this.store.createWard(this.wardForm.getRawValue());
      this.wardForm.markAsPristine();
      this.wardOpen.set(false);
      this.toast.success('Ward created successfully.');
    } catch (error: any) {
      this.wardError.set(error?.error?.message ?? error?.message ?? 'Ward could not be created.');
    } finally {
      this.wardSubmitting.set(false);
    }
  }
}
