import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { ToastService } from '../../../core/services/toast.service';
@Component({ imports: [ReactiveFormsModule, AppModal], templateUrl: './admission-form.html' })
export class AdmissionForm {
  readonly store = inject(InpatientStore);
  readonly clinical = inject(ClinicalStore);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private dates = inject(AppDateTimeService);
  private toast = inject(ToastService);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    type: ['Planned' as const],
    departmentId: ['', Validators.required],
    attendingDoctorId: ['', Validators.required],
    admittedAt: [this.dates.formDateTime()],
    bedId: ['', Validators.required],
    reason: ['', Validators.required],
    initialDiagnosis: ['', Validators.required],
    notes: [''],
  });
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue(),
      p = this.clinical.patients().find((x) => x.id === v.patientId)!;
    try {
      this.submitting.set(true);
      await this.store.admit(
        {
          patientId: v.patientId,
          patientName: `${p.firstName} ${p.lastName}`,
          admittedAt: this.dates.formDateTimeToApi(v.admittedAt),
          type: v.type,
          departmentId: v.departmentId,
          attendingDoctorId: v.attendingDoctorId,
          reason: v.reason,
          initialDiagnosis: v.initialDiagnosis,
          notes: v.notes,
        },
        v.bedId,
      );
      this.form.markAsPristine();
      this.toast.success('Admission created successfully.');
      await this.router.navigateByUrl('/inpatient');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
  close() { void this.router.navigateByUrl('/inpatient'); }
}
