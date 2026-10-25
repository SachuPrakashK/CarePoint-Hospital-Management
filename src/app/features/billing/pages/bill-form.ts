import { Component, computed, inject, input, OnChanges, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { AppIcon } from '../../../shared/components/icon/app-icon';
@Component({
  selector: 'app-bill-form',
  imports: [ReactiveFormsModule, AppIcon],
  templateUrl: './bill-form.html',
  styleUrl: './bill-form.scss',
})
export class BillForm implements OnChanges {
  private fb = inject(FormBuilder);
  private store = inject(Phase23Store);
  readonly patients = inject(PatientStore);
  entity = input<any | null>(null);
  saved = output<void>();
  cancelled = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  private readonly idempotencyKey = crypto.randomUUID();
  readonly patientQuery = signal('');
  readonly filteredPatients = computed(() => {
    const query = this.patientQuery().trim().toLocaleLowerCase();
    if (!query) return this.patients.patients();
    return this.patients
      .patients()
      .filter((patient) =>
        `${patient.firstName} ${patient.lastName} ${patient.mrn}`
          .toLocaleLowerCase()
          .includes(query),
      );
  });
  form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    items: this.fb.array([this.item()], Validators.minLength(1)),
  });
  constructor() {
    this.patients.pageSize.set(100);
    void this.patients.load();
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  get items() {
    return this.form.controls.items as FormArray;
  }
  private item(v: any = {}) {
    return this.fb.nonNullable.group({
      source: [v.source ?? 'Manual', [Validators.required, Validators.maxLength(80)]],
      sourceId: [v.sourceId ?? crypto.randomUUID(), Validators.required],
      description: [
        v.description ?? '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(240)],
      ],
      quantity: [
        Number(v.quantity ?? 1),
        [Validators.required, Validators.min(0.01), Validators.max(100000)],
      ],
      unitPrice: [
        Number(v.unitPrice ?? 0),
        [Validators.required, Validators.min(0), Validators.max(100000000)],
      ],
    });
  }
  ngOnChanges() {
    this.form.controls.patientId.setValue(this.entity()?.patientId ?? '');
    this.items.clear();
    for (const x of this.entity()?.items?.length ? this.entity().items : [{}])
      this.items.push(this.item(x));
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  }
  add() {
    this.items.push(this.item());
  }
  filterPatients(event: Event) {
    this.patientQuery.set((event.target as HTMLInputElement).value);
  }
  remove(i: number) {
    this.items.removeAt(i);
  }
  total() {
    return this.items
      .getRawValue()
      .reduce((s, x) => s + Number(x.quantity) * Number(x.unitPrice), 0);
  }
  lineTotal(index: number) {
    const item = this.items.at(index).getRawValue();
    return Number(item.quantity) * Number(item.unitPrice);
  }
  money(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    try {
      await this.store.saveInvoice(this.form.getRawValue(), this.idempotencyKey, this.entity()?.id);
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'Invoice could not be saved.';
    } finally {
      this.submitting = false;
    }
  }
}
