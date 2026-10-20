import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { sortTableRows } from '../../../shared/utils/table-sort';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';

@Component({
  imports: [
    ReactiveFormsModule,
    StatusBadge,
    EmptyState,
    TableSortHeader,
    ColumnConfig,
    SummaryCard,
  ],
  templateUrl: './nursing-page.html',
  styleUrl: './nursing-page.scss',
})
export class NursingPage {
  readonly store = inject(InpatientStore);
  readonly auth = inject(AuthStore);
  private dates = inject(AppDateTimeService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private preferences = inject(TablePreferencesService);

  readonly selected = signal('');
  readonly savingNote = signal(false);
  readonly medicationSubmitting = signal(false);
  readonly handoverSubmitting = signal(false);
  readonly medicationDialog = signal<any | null>(null);
  readonly handoverDialog = signal(false);
  readonly noteError = signal('');
  readonly medicationError = signal('');
  readonly handoverError = signal('');
  readonly canEdit = computed(() => this.auth.has('nursing.edit'));
  readonly patientContexts = computed(() => {
    const assigned = this.store.assignedPatients();
    if (!this.auth.user()?.roles.some((role) => role.code === 'HOSPITAL_ADMIN')) return assigned;
    const assignedIds = new Set(assigned.map((item) => item.admission.id));
    return [
      ...assigned,
      ...this.store
        .activeAdmissions()
        .filter((admission) => !assignedIds.has(admission.id))
        .map((admission) => ({
          id: `unassigned-${admission.id}`,
          admission,
          patientName: admission.patientName,
          mrn: '',
          shift: 'UNASSIGNED',
        })),
    ];
  });
  readonly selectedMedications = computed(() =>
    this.store.medications().filter((item) => item.admissionId === this.selected()),
  );
  readonly selectedNotes = computed(() =>
    this.store.nursingNotes().filter((item) => item.admissionId === this.selected()),
  );
  readonly assignedSort = signal<TableSort | null>(null);
  readonly handoverSort = signal<TableSort | null>(null);
  readonly assignedColumns: readonly TableColumnDefinition[] = [
    {
      id: 'patient',
      header: 'Patient',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'patient',
    },
    {
      id: 'admission',
      header: 'Admission',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'admission',
    },
    {
      id: 'location',
      header: 'Location',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'location',
    },
    { id: 'doctor', header: 'Doctor', visibleByDefault: true, sortable: true, sortKey: 'doctor' },
    { id: 'shift', header: 'Shift', visibleByDefault: true, sortable: true, sortKey: 'shift' },
    { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
  ];
  readonly handoverColumns: readonly TableColumnDefinition[] = [
    {
      id: 'date',
      header: 'Date/time',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'createdAt',
    },
    {
      id: 'patient',
      header: 'Patient',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'patient',
    },
    { id: 'shift', header: 'Shift', visibleByDefault: true, sortable: true, sortKey: 'shift' },
    {
      id: 'from',
      header: 'Handed over by',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'from',
    },
    { id: 'to', header: 'Received by', visibleByDefault: true, sortable: true, sortKey: 'to' },
    { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
    { id: 'actions', header: 'Action', visibleByDefault: true, required: true },
  ];
  readonly assignedVisible = signal(
    this.preferences.load('nursing-assigned', this.assignedColumns),
  );
  readonly handoverVisible = signal(
    this.preferences.load('nursing-handovers', this.handoverColumns),
  );
  readonly assignedRows = computed(() =>
    sortTableRows(this.store.assignedPatients(), this.assignedSort(), {
      patient: (x) => x.patientName,
      admission: (x) => x.admission.number,
      location: (x) => x.admission.allocations[0]?.ward,
      doctor: (x) => x.admission.attendingDoctor,
      shift: (x) => x.shift,
      status: (x) => x.admission.status,
    }),
  );
  readonly handoverRows = computed(() =>
    sortTableRows(this.store.handovers(), this.handoverSort(), {
      createdAt: (x) => new Date(x.createdAt).getTime(),
      patient: (x) => x.admission?.patient?.firstName,
      shift: (x) => x.fromShift,
      from: (x) => x.handedOverBy?.firstName,
      to: (x) => x.handedOverTo?.firstName,
      status: (x) => x.status,
    }),
  );

  readonly noteForm = this.fb.nonNullable.group({
    observation: ['', [Validators.required, Validators.maxLength(2000)]],
    intervention: ['', [Validators.required, Validators.maxLength(2000)]],
    notes: ['', Validators.maxLength(4000)],
  });
  readonly medicationForm = this.fb.nonNullable.group({
    status: ['Administered', Validators.required],
    notes: ['', Validators.maxLength(1000)],
  });
  readonly handoverForm = this.fb.nonNullable.group({
    admissionId: ['', Validators.required],
    fromShift: ['MORNING', Validators.required],
    toShift: ['EVENING', Validators.required],
    handedOverToId: [''],
    clinicalSummary: ['', [Validators.required, Validators.maxLength(4000)]],
    currentCondition: ['', [Validators.required, Validators.maxLength(2000)]],
    importantObservations: ['', Validators.maxLength(4000)],
    pendingTasks: ['', Validators.maxLength(4000)],
    medicationNotes: ['', Validators.maxLength(4000)],
    investigationsPending: ['', Validators.maxLength(4000)],
    specialInstructions: ['', Validators.maxLength(4000)],
    riskAlerts: ['', Validators.maxLength(4000)],
    additionalNotes: ['', Validators.maxLength(4000)],
  });

  constructor() {
    void this.initialize();
    void this.preferences
      .loadRemote('nursing-assigned', this.assignedColumns)
      .then((ids) => this.assignedVisible.set(ids));
    void this.preferences
      .loadRemote('nursing-handovers', this.handoverColumns)
      .then((ids) => this.handoverVisible.set(ids));
  }
  visible(kind: 'assigned' | 'handover', id: string) {
    return (kind === 'assigned' ? this.assignedVisible() : this.handoverVisible()).includes(id);
  }
  ariaSort(kind: 'assigned' | 'handover', field: string): 'ascending' | 'descending' | 'none' {
    const sort = kind === 'assigned' ? this.assignedSort() : this.handoverSort();
    return sort?.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }
  changeSort(kind: 'assigned' | 'handover', value: TableSort | null) {
    (kind === 'assigned' ? this.assignedSort : this.handoverSort).set(value);
  }
  async applyColumns(kind: 'assigned' | 'handover', ids: string[]) {
    const columns = kind === 'assigned' ? this.assignedColumns : this.handoverColumns;
    const sort = kind === 'assigned' ? this.assignedSort : this.handoverSort;
    if (sort() && !columns.some((x) => ids.includes(x.id) && x.sortKey === sort()!.field))
      sort.set(null);
    (kind === 'assigned' ? this.assignedVisible : this.handoverVisible).set(ids);
    await this.preferences.save(
      kind === 'assigned' ? 'nursing-assigned' : 'nursing-handovers',
      ids,
    );
  }
  async resetColumns(kind: 'assigned' | 'handover') {
    const id = kind === 'assigned' ? 'nursing-assigned' : 'nursing-handovers',
      columns = kind === 'assigned' ? this.assignedColumns : this.handoverColumns;
    await this.preferences.reset(id);
    (kind === 'assigned' ? this.assignedVisible : this.handoverVisible).set(
      this.preferences.load(id, columns),
    );
  }

  private async initialize() {
    await this.store.loadNursing();
    if (!this.selected() && this.patientContexts().length)
      await this.selectAdmission(this.patientContexts()[0].admission.id);
  }

  async selectAdmission(id: string) {
    this.selected.set(id);
    this.handoverForm.controls.admissionId.setValue(id);
    if (id) await this.store.loadNursing(id);
  }

  openAdmission(id: string) {
    void this.router.navigate(['/inpatient', id]);
  }

  formatDateTime(value?: string | null) {
    return value ? this.dates.formatDateTime(value) : 'Not available';
  }

  pendingMeds() {
    return this.store.medications().filter((item) => item.status === 'Scheduled').length;
  }

  async saveNote() {
    this.noteForm.markAllAsTouched();
    if (this.noteForm.invalid || !this.selected() || this.savingNote()) return;
    this.savingNote.set(true);
    this.noteError.set('');
    try {
      await this.store.addNursingNote({
        admissionId: this.selected(),
        ...this.noteForm.getRawValue(),
      });
      this.noteForm.reset({ observation: '', intervention: '', notes: '' });
      this.toast.success('Nursing note recorded.');
    } catch (error: any) {
      const message = error?.error?.message ?? 'The nursing note could not be recorded.';
      this.noteError.set(message);
      this.toast.error(message);
    } finally {
      this.savingNote.set(false);
    }
  }

  openMedication(item: any, status = 'Administered') {
    if (!this.canEdit() || item.status !== 'Scheduled') return;
    this.medicationError.set('');
    this.medicationForm.reset({ status, notes: '' });
    this.medicationDialog.set(item);
  }

  closeMedication() {
    if (!this.medicationSubmitting()) this.medicationDialog.set(null);
  }

  async recordMedication() {
    const item = this.medicationDialog();
    this.medicationForm.markAllAsTouched();
    if (!item || this.medicationForm.invalid || this.medicationSubmitting()) return;
    this.medicationSubmitting.set(true);
    this.medicationError.set('');
    try {
      const value = this.medicationForm.getRawValue();
      await this.store.administerMedication(item.id, value.status, value.notes);
      this.medicationDialog.set(null);
      this.toast.success(`Medication marked ${value.status.toLowerCase()}.`);
    } catch (error: any) {
      const message = error?.error?.message ?? 'Medication administration could not be recorded.';
      this.medicationError.set(message);
      this.toast.error(message);
    } finally {
      this.medicationSubmitting.set(false);
    }
  }

  openHandover() {
    this.handoverError.set('');
    this.handoverForm.reset({
      admissionId: this.selected(),
      fromShift: 'MORNING',
      toShift: 'EVENING',
      handedOverToId: '',
      clinicalSummary: '',
      currentCondition: '',
      importantObservations: '',
      pendingTasks: '',
      medicationNotes: '',
      investigationsPending: '',
      specialInstructions: '',
      riskAlerts: '',
      additionalNotes: '',
    });
    this.handoverDialog.set(true);
  }

  closeHandover() {
    if (!this.handoverSubmitting()) this.handoverDialog.set(false);
  }

  async submitHandover() {
    this.handoverForm.markAllAsTouched();
    const value = this.handoverForm.getRawValue();
    if (this.handoverForm.invalid || value.fromShift === value.toShift || this.handoverSubmitting())
      return;
    this.handoverSubmitting.set(true);
    this.handoverError.set('');
    try {
      await this.store.createHandover({ ...value, handedOverToId: value.handedOverToId || null });
      this.handoverDialog.set(false);
      this.toast.success('Shift handover recorded.');
    } catch (error: any) {
      const message = error?.error?.message ?? 'The shift handover could not be recorded.';
      this.handoverError.set(message);
      this.toast.error(message);
    } finally {
      this.handoverSubmitting.set(false);
    }
  }

  async acknowledge(id: string) {
    try {
      await this.store.acknowledgeHandover(id);
      this.toast.success('Shift handover acknowledged.');
    } catch (error: any) {
      this.toast.error(error?.error?.message ?? 'The handover could not be acknowledged.');
    }
  }
}
