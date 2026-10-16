import { Component, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClinicalStore } from '../../../core/services/clinical.store';
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './consultation-page.html',
  styleUrl: './consultation-page.scss',
})
export class ConsultationPage {
  id = input('');
  readonly store = inject(ClinicalStore);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  readonly tab = signal('Clinical notes');
  readonly tabs = ['Clinical notes', 'Vitals', 'Prescription', 'Follow-up'];
  readonly appointment = computed(() => this.store.appointments().find((a) => a.id === this.id()));
  readonly patient = computed(() =>
    this.store.patients().find((p) => p.id === this.appointment()?.patientId),
  );
  readonly form = this.fb.nonNullable.group({
    chiefComplaint: ['', Validators.required],
    symptoms: [''],
    examination: [''],
    primaryDiagnosis: ['', Validators.required],
    secondaryDiagnoses: [''],
    notes: [''],
    treatmentPlan: [''],
    temperature: [0],
    pulse: [0],
    bloodPressure: [''],
    spo2: [0],
    height: [0],
    weight: [0],
    painScore: [0],
    medicines: this.fb.array([]),
    followUpDate: [''],
    followUpInstructions: [''],
  });
  get medicines() {
    return this.form.controls.medicines as FormArray;
  }
  readonly bmi = computed(() => {
    const h = this.form.controls.height.value / 100,
      w = this.form.controls.weight.value;
    return h && w ? (w / (h * h)).toFixed(1) : '—';
  });
  constructor() {
    this.store.updateStatus(this.id?.() ?? '', 'In Consultation');
    this.addMedicine();
  }
  addMedicine() {
    this.medicines.push(
      this.fb.nonNullable.group({
        medicine: ['', Validators.required],
        strength: [''],
        dose: [''],
        frequency: ['Once daily'],
        route: ['Oral'],
        duration: [''],
        quantity: [1],
        instructions: [''],
      }),
    );
  }
  async complete() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.tab.set('Clinical notes');
      return;
    }
    const v = this.form.getRawValue();
    const [systolic, diastolic] = v.bloodPressure.split('/').map(Number);
    await this.store.saveConsultation({
      appointmentId: this.id(),
      chiefComplaint: v.chiefComplaint,
      symptoms: v.symptoms,
      examination: v.examination,
      primaryDiagnosis: v.primaryDiagnosis,
      secondaryDiagnoses: v.secondaryDiagnoses.split(',').filter(Boolean),
      notes: v.notes,
      treatmentPlan: v.treatmentPlan,
      vitals: [
        {
          id: crypto.randomUUID(),
          recordedAt: new Date().toISOString(),
          recordedBy: 'Current user',
          temperature: v.temperature || undefined,
          pulse: v.pulse || undefined,
          systolic,
          diastolic,
          spo2: v.spo2 || undefined,
          height: v.height || undefined,
          weight: v.weight || undefined,
          bmi: Number(this.bmi()) || undefined,
          painScore: v.painScore || undefined,
        },
      ],
      prescription: v.medicines,
      followUpDate: v.followUpDate || undefined,
      followUpInstructions: v.followUpInstructions,
    });
    await this.router.navigateByUrl('/opd');
  }
}
