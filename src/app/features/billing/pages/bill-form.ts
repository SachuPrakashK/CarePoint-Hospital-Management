import { Component, inject, input, OnChanges, output } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
@Component({
  selector: 'app-bill-form',
  imports: [ReactiveFormsModule],
  templateUrl: './bill-form.html',
})
export class BillForm implements OnChanges {
  private fb = inject(FormBuilder);
  private store = inject(Phase23Store);
  readonly patients = inject(PatientStore);
  entity = input<any | null>(null);
  saved = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    items: this.fb.array([this.item()]),
  });
  constructor() {
    void this.patients.load();
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  get items() {
    return this.form.controls.items as FormArray;
  }
  private item(v: any = {}) {
    return this.fb.nonNullable.group({
      source: [v.source ?? 'Manual', Validators.required],
      sourceId: [v.sourceId ?? crypto.randomUUID(), Validators.required],
      description: [v.description ?? '', Validators.required],
      quantity: [Number(v.quantity ?? 1), [Validators.required, Validators.min(0.01)]],
      unitPrice: [Number(v.unitPrice ?? 0), [Validators.required, Validators.min(0)]],
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
  remove(i: number) {
    if (this.items.length > 1) this.items.removeAt(i);
  }
  total() {
    return this.items
      .getRawValue()
      .reduce((s, x) => s + Number(x.quantity) * Number(x.unitPrice), 0);
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    try {
      await this.store.saveInvoice(this.form.getRawValue(), this.entity()?.id);
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
