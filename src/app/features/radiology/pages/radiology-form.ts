import { Component, inject, input, OnChanges, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { MasterApiService } from '../../administration/master-api.service';
import { firstValueFrom } from 'rxjs';
@Component({
  selector: 'app-radiology-form',
  imports: [ReactiveFormsModule],
  templateUrl: './radiology-form.html',
})
export class RadiologyForm implements OnChanges {
  private fb = inject(FormBuilder);
  private dates = inject(AppDateTimeService);
  readonly store = inject(Phase23Store);
  readonly patients = inject(PatientStore);
  private mastersApi = inject(MasterApiService);
  readonly investigations = signal<any[]>([]);
  entity = input<any | null>(null);
  saved = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  form = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    investigation: ['', [Validators.required, Validators.minLength(2)]],
    doctor: ['', [Validators.required, Validators.minLength(2)]],
    scheduledAt: [''],
    status: ['Ordered', Validators.required],
    findings: [''],
    impression: [''],
    reportedBy: [''],
    verifiedBy: [''],
  });
  constructor() {
    void this.patients.load();
    void firstValueFrom(this.mastersApi.list('radiology-investigations', '', 'Active')).then(
      (response) => this.investigations.set(response.data),
    );
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  ngOnChanges() {
    this.form.reset({ status: 'Ordered' });
    const e = this.entity();
    if (e)
      this.form.patchValue({
        ...e,
        scheduledAt: e.scheduledAt ? this.dates.formDateTime(new Date(e.scheduledAt)) : '',
      });
    this.form.markAsPristine();
    this.dirtyChanged.emit(false);
  }
  async submit() {
    if (this.submitting) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitting = true;
    this.error = '';
    const v = this.form.getRawValue();
    const payload = Object.fromEntries(
      Object.entries({
        ...v,
        scheduledAt: v.scheduledAt ? this.dates.formDateTimeToApi(v.scheduledAt) : undefined,
      }).filter(([, value]) => value !== null && value !== '' && value !== undefined),
    );
    try {
      await this.store.saveRadiology(payload, this.entity()?.id);
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'Radiology order could not be saved.';
    } finally {
      this.submitting = false;
    }
  }
}
