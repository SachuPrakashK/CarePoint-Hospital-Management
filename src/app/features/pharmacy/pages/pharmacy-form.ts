import { Component, inject, input, OnChanges, output } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PharmacyStore } from '../../../core/services/pharmacy.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
@Component({
  selector: 'app-pharmacy-form',
  imports: [ReactiveFormsModule],
  templateUrl: './pharmacy-form.html',
})
export class PharmacyForm implements OnChanges {
  private fb = inject(FormBuilder);
  readonly store = inject(PharmacyStore);
  private dates = inject(AppDateTimeService);
  kind = input.required<'medicine' | 'batch'>();
  entity = input<any | null>(null);
  saved = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  form = this.fb.group({
    name: [''],
    genericName: [''],
    brand: [''],
    category: [''],
    strength: [''],
    form: [''],
    unit: [''],
    barcode: [''],
    status: ['Active'],
    medicineId: [''],
    batchNumber: [''],
    expiresAt: [''],
    purchasePrice: [0],
    sellingPrice: [0],
    quantity: [0],
    reorderLevel: [0],
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  private futureDate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(`${control.value}T00:00:00`).getTime() > today.getTime() ? null : { futureDate: true };
  }
  ngOnChanges() {
    for (const c of Object.values(this.form.controls)) {
      c.clearValidators();
      c.updateValueAndValidity({ emitEvent: false });
    }
    const req = (...n: (keyof typeof this.form.controls)[]) =>
      n.forEach((x) => this.form.controls[x].addValidators(Validators.required));
    if (this.kind() === 'medicine') {
      req('name', 'genericName', 'brand', 'category', 'strength', 'form', 'unit');
      this.form.controls.name.addValidators(Validators.minLength(2));
      this.form.controls.genericName.addValidators(Validators.minLength(2));
    } else {
      req(
          'medicineId',
          'batchNumber',
          'expiresAt',
          'purchasePrice',
          'sellingPrice',
          'quantity',
          'reorderLevel',
      );
      for (const key of ['purchasePrice', 'sellingPrice', 'reorderLevel'] as const)
        this.form.controls[key].addValidators(Validators.min(0));
      this.form.controls.quantity.addValidators(Validators.min(1));
      this.form.controls.expiresAt.addValidators(this.futureDate);
    }
    this.form.reset({
      status: 'Active',
      medicineId: '',
      purchasePrice: 0,
      sellingPrice: 0,
      quantity: 0,
      reorderLevel: 0,
    });
    if (this.entity())
      this.form.patchValue({ ...this.entity(), expiresAt: this.entity().expiresAt?.slice(0, 10) });
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    const v = this.form.getRawValue();
    try {
      if (this.kind() === 'medicine')
        await this.store.saveMedicine(
          this.entity() ? 'edit' : 'create',
          {
            name: v.name,
            genericName: v.genericName,
            brand: v.brand,
            category: v.category,
            strength: v.strength,
            form: v.form,
            unit: v.unit,
            barcode: v.barcode || null,
            status: v.status,
          },
          this.entity()?.id,
        );
      else
        await this.store.saveBatch(
          {
            medicineId: v.medicineId,
            batchNumber: v.batchNumber,
            expiresAt: this.dates.formValueToApi(v.expiresAt!, '00:00'),
            purchasePrice: Number(v.purchasePrice),
            sellingPrice: Number(v.sellingPrice),
            quantity: Number(v.quantity),
            reorderLevel: Number(v.reorderLevel),
          },
          this.entity()?.id,
        );
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'The pharmacy record could not be saved.';
    } finally {
      this.submitting = false;
    }
  }
}
