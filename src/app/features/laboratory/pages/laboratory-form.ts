import { Component, inject, input, OnChanges, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PatientStore } from '../../patients/patient.store';
import { MasterApiService } from '../../administration/master-api.service';
import { AppointmentApiService } from '../../appointments/appointment-api.service';
@Component({
  selector: 'app-laboratory-form',
  imports: [ReactiveFormsModule],
  templateUrl: './laboratory-form.html',
})
export class LaboratoryForm implements OnChanges {
  private fb = inject(FormBuilder);
  private api = inject(Phase23ApiService);
  private mastersApi = inject(MasterApiService);
  private appointmentsApi = inject(AppointmentApiService);
  readonly patients = inject(PatientStore);
  private store = inject(Phase23Store);
  mode = input.required<'create' | 'edit' | 'result'>();
  order = input<any | null>(null);
  saved = output<void>();
  dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  readonly tests = signal<any[]>([]);
  readonly doctors = signal<any[]>([]);
  form = this.fb.group({
    patientId: ['', Validators.required],
    doctorId: ['', Validators.required],
    testDefinitionId: ['', Validators.required],
    priority: ['Routine', Validators.required],
    clinicalNotes: ['', Validators.maxLength(1000)],
    sampleType: ['Blood', [Validators.required, Validators.maxLength(80)]],
    value: [''],
    unit: [''],
    referenceRange: [''],
    abnormal: [false],
    notes: [''],
  });
  constructor() {
    void this.patients.load();
    void firstValueFrom(this.mastersApi.list('laboratory-tests', '', 'Active')).then(
      (r) => this.tests.set(r.data),
    );
    void firstValueFrom(this.appointmentsApi.options()).then((r) => this.doctors.set(r.data.doctors));
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  ngOnChanges() {
    this.form.reset({ priority: 'Routine', sampleType: 'Blood', abnormal: false });
    if (this.order())
      this.form.patchValue({
        patientId: this.order().patientId,
        doctorId: this.order().doctorId ?? this.order().orderingDoctor?.id ?? '',
        testDefinitionId: this.order().orderTests?.[0]?.testDefinitionId ?? this.order().orderTests?.[0]?.testDefinition?.id ?? '',
      });
    this.mode() === 'result'
      ? this.form.controls.value.addValidators(Validators.required)
      : this.form.controls.value.clearValidators();
    this.form.controls.value.updateValueAndValidity({ emitEvent: false });
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
    try {
      if (this.mode() === 'create' || this.mode() === 'edit') {
        const payload = {
          patientId: v.patientId,
          doctorId: v.doctorId,
          testDefinitionIds: [v.testDefinitionId],
          priority: v.priority,
          clinicalNotes: v.clinicalNotes?.trim() || undefined,
          sampleType: v.sampleType?.trim(),
        };
        await firstValueFrom(
          this.mode() === 'create'
            ? this.api.createLab(payload)
            : this.api.updateLab(this.order().id, payload),
        );
      } else
        await firstValueFrom(
          this.api.labResult(this.order().id, {
            actor: 'Current user',
            results: [
              {
                test: this.order().tests[0],
                value: v.value,
                unit: v.unit || undefined,
                referenceRange: v.referenceRange || undefined,
                abnormal: !!v.abnormal,
                notes: v.notes || undefined,
              },
            ],
          }),
        );
      await this.store.loadAll();
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? e?.message ?? 'Laboratory record could not be saved.';
    } finally {
      this.submitting = false;
    }
  }
}
