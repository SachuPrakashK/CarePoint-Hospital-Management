import { Component, computed, inject, input } from '@angular/core';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { InpatientStore } from '../../../core/services/inpatient.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
@Component({ templateUrl: './discharge-summary.html', styleUrl: './discharge-summary.scss' })
export class DischargeSummaryPage {
  id = input('');
  private store = inject(InpatientStore);
  private clinical = inject(ClinicalStore);
  private dates = inject(AppDateTimeService);
  summary = computed(() => this.store.discharges().find((s) => s.id === this.id()));
  admission = computed(() =>
    this.store.admissions().find((a) => a.id === this.summary()?.admissionId),
  );
  patient = computed(() =>
    this.clinical.patients().find((p) => p.id === this.summary()?.patientId),
  );
  patientName() {
    const p = this.patient();
    return p ? `${p.firstName} ${p.lastName}` : '—';
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
  print() {
    window.print();
  }
  back() {
    history.back();
  }
}
