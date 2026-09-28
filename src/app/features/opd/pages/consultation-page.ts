import { Component, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClinicalStore } from '../../../core/services/clinical.store';
@Component({
  imports: [ReactiveFormsModule],
  template: `@if (appointment(); as a) {
      <div class="page-head">
        <div>
          <div class="breadcrumbs">OPD / Consultation / {{ a.number }}</div>
          <h1>{{ a.patientName }}</h1>
          <p class="muted">{{ a.doctor }} · {{ a.department }} · Token {{ a.token }}</p>
        </div>
        <span class="status warn">In consultation</span>
      </div>
      <form [formGroup]="form" (ngSubmit)="complete()">
        <div class="consult-grid">
          <aside class="card patient-summary">
            <h3>Patient summary</h3>
            <p>
              <b>{{ patient()?.mrn }}</b>
            </p>
            <p>{{ patient()?.gender }} · {{ patient()?.bloodGroup }}</p>
            <hr />
            <small>ALLERGY ALERTS</small>
            <p>
              @for (x of patient()?.allergies; track x) {
                <span class="status danger">{{ x }}</span>
              } @empty {
                None recorded
              }
            </p>
          </aside>
          <main>
            <div class="tabs">
              @for (t of tabs; track t) {
                <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
                  {{ t }}
                </button>
              }
            </div>
            @if (tab() === 'Clinical notes') {
              <section class="card">
                <div class="form-grid">
                  <label class="field full"
                    >Chief complaint <span class="required-indicator">*</span><textarea
                      formControlName="chiefComplaint"
                      placeholder="Patient's primary concern"
                    ></textarea></label
                  ><label class="field full"
                    >Symptoms<textarea
                      formControlName="symptoms"
                      placeholder="Symptoms, onset and duration"
                    ></textarea></label
                  ><label class="field full"
                    >Clinical examination<textarea
                      formControlName="examination"
                      placeholder="Examination findings"
                    ></textarea></label
                  ><label class="field"
                    >Primary diagnosis <span class="required-indicator">*</span><input
                      formControlName="primaryDiagnosis"
                      placeholder="Diagnosis" /></label
                  ><label class="field"
                    >Secondary diagnoses<input
                      formControlName="secondaryDiagnoses"
                      placeholder="Separated by commas" /></label
                  ><label class="field full"
                    >Clinical notes<textarea
                      formControlName="notes"
                      placeholder="Relevant clinical notes"
                    ></textarea></label
                  ><label class="field full"
                    >Treatment plan<textarea
                      formControlName="treatmentPlan"
                      placeholder="Treatment and care plan"
                    ></textarea>
                  </label>
                </div>
              </section>
            }
            @if (tab() === 'Vitals') {
              <section class="card">
                <div class="section-title">
                  <h2>New vital reading</h2>
                  <small>Historical readings are never overwritten</small>
                </div>
                <div class="form-grid">
                  <label class="field"
                    >Temperature °C<input type="number" formControlName="temperature" /></label
                  ><label class="field"
                    >Pulse bpm<input type="number" formControlName="pulse" /></label
                  ><label class="field"
                    >Blood pressure<input
                      formControlName="bloodPressure"
                      placeholder="120/80" /></label
                  ><label class="field">SpO₂ %<input type="number" formControlName="spo2" /></label
                  ><label class="field"
                    >Height cm<input type="number" formControlName="height" /></label
                  ><label class="field"
                    >Weight kg<input type="number" formControlName="weight" /></label
                  ><label class="field">BMI<input [value]="bmi()" readonly /></label
                  ><label class="field"
                    >Pain score (0–10)<input type="number" formControlName="painScore"
                  /></label>
                </div>
              </section>
            }
            @if (tab() === 'Prescription') {
              <section class="card">
                <div class="section-title">
                  <h2>Medicines</h2>
                  <button type="button" class="secondary" (click)="addMedicine()">
                    + Add medicine
                  </button>
                </div>
                <div formArrayName="medicines">
                  @for (row of medicines.controls; track $index) {
                    <div class="medicine" [formGroupName]="$index">
                      <input formControlName="medicine" placeholder="Medicine" /><input
                        formControlName="strength"
                        placeholder="Strength"
                      /><input formControlName="dose" placeholder="Dose" /><select
                        formControlName="frequency"
                      >
                        <option>Once daily</option>
                        <option>Twice daily</option>
                        <option>Three times daily</option>
                        <option>As needed</option></select
                      ><input formControlName="duration" placeholder="Duration" /><input
                        type="number"
                        formControlName="quantity"
                        placeholder="Qty"
                      /><button type="button" class="danger" (click)="medicines.removeAt($index)">
                        ×</button
                      ><input
                        class="instructions"
                        formControlName="instructions"
                        placeholder="Instructions"
                      />
                    </div>
                  }
                </div>
              </section>
            }
            @if (tab() === 'Follow-up') {
              <section class="card">
                <div class="form-grid">
                  <label class="field"
                    >Follow-up date<input type="date" formControlName="followUpDate" /></label
                  ><label class="field full"
                    >Instructions<textarea
                      formControlName="followUpInstructions"
                      placeholder="Instructions for the patient and reception"
                    ></textarea>
                  </label>
                </div>
              </section>
            }
            <div class="form-actions sticky">
              <button type="button" class="secondary">Save draft</button
              ><button class="primary">Complete consultation</button>
            </div>
          </main>
        </div>
      </form>
    } @else {
      <div class="empty">Appointment not found.</div>
    }`,
  styles: [
    `
      .consult-grid {
        display: grid;
        grid-template-columns: 230px 1fr;
        gap: 18px;
      }
      .patient-summary {
        padding: 18px;
        height: max-content;
        position: sticky;
        top: 92px;
      }
      .medicine {
        display: grid;
        grid-template-columns: 1.5fr repeat(5, 1fr) auto;
        gap: 8px;
        padding: 14px;
        border-bottom: 1px solid #e4ebed;
      }
      .medicine input,
      .medicine select {
        min-width: 0;
        border: 1px solid #cbd7da;
        border-radius: 6px;
        padding: 9px;
      }
      .instructions {
        grid-column: 1/-1;
      }
      .sticky {
        position: sticky;
        bottom: 0;
        background: white;
        box-shadow: 0 -5px 20px #18323b0a;
        margin-top: 15px;
      }
      @media (max-width: 900px) {
        .consult-grid {
          grid-template-columns: 1fr;
        }
        .patient-summary {
          position: static;
        }
        .medicine {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
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
  complete() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.tab.set('Clinical notes');
      return;
    }
    const v = this.form.getRawValue();
    const [systolic, diastolic] = v.bloodPressure.split('/').map(Number);
    this.store.saveConsultation({
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
    void this.router.navigateByUrl('/opd');
  }
}
