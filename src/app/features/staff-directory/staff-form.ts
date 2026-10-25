import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SafeApiError } from '../../core/interceptors/api-error.interceptor';
import {
  StaffDirectoryApiService,
  StaffKind,
  StaffOptions,
  StaffRecord,
} from './staff-directory-api.service';
@Component({
  selector: 'app-staff-form',
  imports: [ReactiveFormsModule],
  templateUrl: './staff-form.html',
  styleUrl: './staff-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffForm {
  private fb = inject(FormBuilder);
  private api = inject(StaffDirectoryApiService);
  readonly kind = input.required<StaffKind>();
  readonly record = input<StaffRecord | null>(null);
  readonly options = input.required<StaffOptions>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly dirtyChanged = output<boolean>();
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    gender: ['', Validators.required],
    dateOfBirth: [''],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{7,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.maxLength(500)],
    employeeCode: ['', [Validators.required, Validators.maxLength(40)]],
    departmentId: ['', Validators.required],
    specializationId: [''],
    medicalRegistration: [''],
    qualification: [''],
    yearsOfExperience: [0, [Validators.min(0), Validators.max(80)]],
    consultationFee: [0, Validators.min(0)],
    designation: [''],
    joiningDate: [''],
    employmentType: ['FULL_TIME'],
    status: ['ACTIVE' as 'ACTIVE' | 'INACTIVE'],
    roleCode: [''],
  });
  readonly populate = effect(() => {
    const value = this.record(),
      kind = this.kind();
    const specialization = this.form.controls.specializationId,
      registration = this.form.controls.medicalRegistration,
      designation = this.form.controls.designation,
      joining = this.form.controls.joiningDate,
      role = this.form.controls.roleCode;
    if (kind === 'doctors') {
      specialization.setValidators(Validators.required);
      registration.setValidators(Validators.required);
      designation.clearValidators();
      joining.clearValidators();
      role.clearValidators();
    } else {
      specialization.clearValidators();
      registration.clearValidators();
      designation.setValidators(Validators.required);
      joining.setValidators(Validators.required);
      role.setValidators(Validators.required);
    }
    for (const c of [specialization, registration, designation, joining, role])
      c.updateValueAndValidity({ emitEvent: false });
    if (value)
      this.form.reset({
        firstName: value.firstName,
        lastName: value.lastName,
        gender: value.gender,
        dateOfBirth: value.dateOfBirth?.slice(0, 10) ?? '',
        phone: value.phone ?? '',
        email: value.email,
        address: value.address ?? '',
        employeeCode: value.employeeCode,
        departmentId: value.departmentId,
        specializationId: value.specializationId ?? '',
        medicalRegistration: value.medicalRegistration ?? '',
        qualification: value.qualification ?? '',
        yearsOfExperience: value.yearsOfExperience ?? 0,
        consultationFee: value.consultationFee ?? 0,
        designation: value.designation ?? '',
        joiningDate: value.joiningDate?.slice(0, 10) ?? '',
        employmentType: value.employmentType ?? 'FULL_TIME',
        status: value.status === 'LOCKED' ? 'INACTIVE' : value.status,
        roleCode: value.roles[0]?.role.code ?? '',
      });
    else
      this.form.reset({
        firstName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        phone: '',
        email: '',
        address: '',
        employeeCode: '',
        departmentId: '',
        specializationId: '',
        medicalRegistration: '',
        qualification: '',
        yearsOfExperience: 0,
        consultationFee: 0,
        designation: '',
        joiningDate: '',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        roleCode: '',
      });
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  specializations() {
    return this.options().specializations.filter(
      (x) => x.departmentId === this.form.controls.departmentId.value,
    );
  }
  departmentChanged() {
    if (!this.specializations().some((x) => x.id === this.form.controls.specializationId.value))
      this.form.controls.specializationId.setValue('');
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(
        this.api.save(this.kind(), this.record()?.id ?? null, {
          ...v,
          dateOfBirth: v.dateOfBirth || null,
          specializationId: v.specializationId || null,
          medicalRegistration: v.medicalRegistration || null,
          joiningDate: v.joiningDate || null,
        }),
      );
      this.form.markAsPristine();
      this.saved.emit();
    } catch (e) {
      this.error.set((e as SafeApiError).message || 'Record could not be saved.');
    } finally {
      this.submitting.set(false);
    }
  }
}
