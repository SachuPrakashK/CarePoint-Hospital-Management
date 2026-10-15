import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { SafeApiError } from '../../../core/interceptors/api-error.interceptor';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient } from '../../../shared/models/clinical.models';
import { PatientStore } from '../patient.store';

export type PatientFormMode = 'create' | 'edit';
const humanName = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const phonePattern = /^(?:\+91)?[6-9]\d{9}$/;
const trimmedRequired = (control: AbstractControl): ValidationErrors | null => String(control.value ?? '').trim() ? null : { required: true };
const normalizePhone = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.length === 12 && digits.startsWith('91') ? `+${digits}` : digits; };

@Component({ selector: 'app-patient-form', imports: [ReactiveFormsModule], templateUrl: './patient-form.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class PatientForm {
  private readonly fb = inject(FormBuilder); private readonly store = inject(PatientStore); private readonly toast = inject(ToastService);
  readonly dates = inject(AppDateTimeService);
  readonly mode = input.required<PatientFormMode>();
  readonly patient = input<Patient | null>(null);
  readonly saved = output<void>();
  readonly submitting = signal(false); readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [trimmedRequired, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(humanName)]],
    middleName: ['', [Validators.maxLength(100), Validators.pattern(/^$|^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u)]],
    lastName: ['', [trimmedRequired, Validators.maxLength(100), Validators.pattern(humanName)]],
    dob: ['', [Validators.required, (control: AbstractControl) => control.value && control.value > this.dates.today() ? { futureDate: true } : null]],
    gender: ['', Validators.required], bloodGroup: ['Unknown'],
    phone: ['', [trimmedRequired, (control: AbstractControl) => phonePattern.test(normalizePhone(String(control.value))) ? null : { phone: true }]],
    email: ['', [Validators.email, Validators.maxLength(254)]], city: ['', Validators.maxLength(100)],
    emergencyContact: ['', [(control: AbstractControl) => !String(control.value).trim() || phonePattern.test(normalizePhone(String(control.value))) ? null : { phone: true }]], allergies: [''],
  });
  private readonly populate = effect(() => { const patient = this.patient(); if (this.mode() === 'edit' && patient) this.form.reset({ ...patient, dob: patient.dob.slice(0, 10), middleName: patient.middleName ?? '', email: patient.email ?? '', emergencyContact: patient.emergencyContact ?? '', allergies: patient.allergies.join(', ') }); });
  invalid(name: keyof typeof this.form.controls, error?: string) { const control = this.form.controls[name]; return control.touched && (error ? control.hasError(error) : control.invalid); }
  async save() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true); this.error.set(''); const value = this.form.getRawValue();
    const payload = { ...value, firstName: value.firstName.trim(), middleName: value.middleName.trim(), lastName: value.lastName.trim(), phone: normalizePhone(value.phone), email: value.email.trim().toLowerCase(), city: value.city.trim(), emergencyContact: normalizePhone(value.emergencyContact), allergies: value.allergies.split(',').map(x => x.trim()).filter(Boolean), status: 'Active' as const };
    try {
      const patient = this.patient();
      if (this.mode() === 'edit' && patient) await this.store.update(patient.id, payload); else await this.store.create(payload);
      this.form.markAsPristine(); this.toast.success(`Patient ${this.mode() === 'edit' ? 'updated' : 'created'} successfully.`); this.saved.emit();
    } catch (cause) { const apiError = cause as SafeApiError; for (const [field, messages] of Object.entries(apiError.validationErrors ?? {})) this.form.get(field)?.setErrors({ ...(this.form.get(field)?.errors ?? {}), server: messages[0] }); this.error.set(apiError.message || 'Patient could not be saved.'); }
    finally { this.submitting.set(false); }
  }
}
