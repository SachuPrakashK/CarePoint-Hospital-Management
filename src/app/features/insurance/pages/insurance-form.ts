import { Component, inject, input, OnChanges, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppIcon } from '../../../shared/components/icon/app-icon';
export type InsuranceFormKind = 'provider' | 'policy' | 'claim';
@Component({
  selector: 'app-insurance-form',
  imports: [ReactiveFormsModule, AppIcon],
  templateUrl: './insurance-form.html',
  styleUrl: './insurance-form.scss',
})
export class InsuranceForm implements OnChanges {
  private fb = inject(FormBuilder);
  readonly store = inject(Phase23Store);
  readonly patients = inject(PatientStore);
  private dates = inject(AppDateTimeService);
  kind = input.required<InsuranceFormKind>();
  entity = input<any | null>(null);
  saved = output<void>();
  cancelled = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  form = this.fb.group({
    name: [''],
    code: [''],
    contact: [''],
    address: [''],
    patientId: [''],
    providerId: [''],
    policyNumber: [''],
    memberNumber: [''],
    startsAt: [''],
    endsAt: [''],
    coverageLimit: [0],
    relationship: ['Self'],
    priority: ['', Validators.required],
    insuranceId: [''],
    invoiceId: [''],
    claimedAmount: [0],
    isActive: [null as boolean | null],
  });
  constructor() {
    void this.patients.load();
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  ngOnChanges() {
    for (const c of Object.values(this.form.controls)) {
      c.clearValidators();
      c.updateValueAndValidity({ emitEvent: false });
    }
    const req = (...keys: (keyof typeof this.form.controls)[]) =>
      keys.forEach((k) => this.form.controls[k].addValidators(Validators.required));
    const requireSelection = (control: { value: unknown }) =>
      control.value === null || control.value === '' ? { required: true } : null;
    if (this.kind() === 'provider') {
      req('name', 'code');
      this.form.controls.isActive.addValidators(requireSelection);
      this.form.controls.name.addValidators(Validators.minLength(2));
      this.form.controls.code.addValidators(Validators.minLength(2));
    } else if (this.kind() === 'policy') {
      req(
        'patientId',
        'providerId',
        'policyNumber',
        'startsAt',
        'endsAt',
        'coverageLimit',
        'relationship',
        'priority',
      );
      this.form.controls.coverageLimit.addValidators(Validators.min(0));
      this.form.controls.isActive.addValidators(requireSelection);
    } else {
      req('patientId', 'insuranceId', 'invoiceId', 'claimedAmount');
      this.form.controls.claimedAmount.addValidators(Validators.min(0.01));
    }
    this.form.reset({
      name: '',
      code: '',
      contact: '',
      address: '',
      patientId: '',
      providerId: '',
      policyNumber: '',
      memberNumber: '',
      startsAt: '',
      endsAt: '',
      relationship: 'Self',
      priority: '',
      coverageLimit: 0,
      insuranceId: '',
      invoiceId: '',
      claimedAmount: 0,
      isActive: null,
    });
    const e = this.entity();
    if (e)
      this.form.patchValue({
        ...e,
        startsAt: e.startsAt?.slice(0, 10),
        endsAt: e.endsAt?.slice(0, 10),
      });
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  }
  async submit() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.kind() === 'policy' && v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      this.error = 'Policy end date must be on or after its start date.';
      return;
    }
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    try {
      if (this.kind() === 'provider')
        await this.store.saveProvider(
          {
            name: v.name,
            code: v.code,
            contact: v.contact || undefined,
            address: v.address || undefined,
            isActive: v.isActive ?? true,
          },
          this.entity()?.id,
        );
      else if (this.kind() === 'policy')
        await this.store.savePolicy(
          {
            patientId: v.patientId,
            providerId: v.providerId,
            policyNumber: v.policyNumber,
            memberNumber: v.memberNumber || undefined,
            startsAt: this.dates.formValueToApi(v.startsAt!, '00:00'),
            endsAt: this.dates.formValueToApi(v.endsAt!, '23:59'),
            coverageLimit: Number(v.coverageLimit),
            relationship: v.relationship,
            priority: v.priority,
            isActive: v.isActive ?? true,
          },
          this.entity()?.id,
        );
      else
        await this.store.submitClaim({
          patientId: v.patientId,
          insuranceId: v.insuranceId,
          invoiceId: v.invoiceId,
          claimedAmount: Number(v.claimedAmount),
        });
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'Insurance record could not be saved.';
    } finally {
      this.submitting = false;
    }
  }
  policies() {
    return this.store
      .policies()
      .filter(
        (x) =>
          x.isActive !== false &&
          new Date(x.startsAt) <= new Date() &&
          new Date(x.endsAt) >= new Date() &&
          (!this.form.controls.patientId.value ||
            x.patientId === this.form.controls.patientId.value),
      );
  }
  invoices() {
    return this.store
      .invoices()
      .filter(
        (x) =>
          !this.form.controls.patientId.value || x.patientId === this.form.controls.patientId.value,
      );
  }
}
