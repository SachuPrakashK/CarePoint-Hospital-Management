import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MasterApiService, MasterType } from './master-api.service';
@Component({
  selector: 'app-master-form',
  imports: [ReactiveFormsModule],
  templateUrl: './master-form.html',
})
export class MasterForm {
  type = input.required<MasterType>();
  mode = input<'create' | 'edit'>('create');
  entity = input<any | null>(null);
  departments = input<any[]>([]);
  saved = output<void>();
  dirtyChanged = output<boolean>();
  private fb = inject(FormBuilder);
  private api = inject(MasterApiService);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    departmentId: [''],
    modality: [''],
    category: ['', Validators.maxLength(80)],
    unit: ['', Validators.maxLength(30)],
    referenceRange: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(500)],
    status: ['Active'],
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  private fill = effect(() => {
    this.form.controls.category.setValidators(
      this.type() === 'laboratory-tests'
        ? [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
        : [Validators.maxLength(80)],
    );
    this.form.controls.category.updateValueAndValidity({ emitEvent: false });
    const e = this.entity();
    this.form.reset({
      code: e?.code ?? '',
      name: e?.name ?? '',
      departmentId: e?.departmentId ?? '',
      modality: e?.modality ?? '',
      category: e?.category ?? '',
      unit: e?.unit ?? '',
      referenceRange: e?.referenceRange ?? '',
      description: e?.description ?? '',
      status: e?.status ?? 'Active',
    });
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  });
  async save() {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      (this.type() === 'specializations' && !this.form.value.departmentId) ||
      (this.type() === 'radiology-investigations' && !this.form.value.modality) ||
      (this.type() === 'laboratory-tests' && !this.form.value.category)
    )
      return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const common = { code: v.code.trim(), name: v.name.trim(), status: v.status };
      const payload =
        this.type() === 'specializations'
          ? { ...common, departmentId: v.departmentId }
          : this.type() === 'radiology-investigations'
            ? {
                ...common,
                modality: v.modality.trim(),
                description: v.description.trim() || undefined,
              }
            : this.type() === 'laboratory-tests'
              ? {
                  ...common,
                  category: v.category.trim(),
                  unit: v.unit.trim() || undefined,
                  referenceRange: v.referenceRange.trim() || undefined,
                  description: v.description.trim() || undefined,
                }
              : common;
      if (this.mode() === 'create') await firstValueFrom(this.api.create(this.type(), payload));
      else await firstValueFrom(this.api.update(this.type(), this.entity().id, payload));
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'The master record could not be saved.');
    } finally {
      this.submitting.set(false);
    }
  }
}
