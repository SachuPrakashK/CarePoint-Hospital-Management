import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClinicalStore } from '../../core/services/clinical.store';
import { InpatientStore } from '../../core/services/inpatient.store';
import { Phase23Store } from '../../core/services/phase23.store';
import { PharmacyStore } from '../../core/services/pharmacy.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { DashboardStore } from '../dashboard/dashboard.store';
@Component({
  imports: [FormsModule],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPage {
  readonly exporting = signal(false);
  readonly clinical = inject(ClinicalStore);
  readonly inpatient = inject(InpatientStore);
  readonly operations = inject(Phase23Store);
  readonly pharmacy = inject(PharmacyStore);
  readonly dashboard = inject(DashboardStore);
  private dates = inject(AppDateTimeService);
  from = this.dates.formDateTime(new Date(Date.now() - 30 * 86400000)).slice(0, 10);
  to = this.dates.today();
  category = 'Management overview';
  readonly activity=computed(()=>{const rows=this.dashboard.patientTrends();const max=Math.max(1,...rows.map(x=>x.count));return rows.map(x=>({day:this.dates.formatDate(x.date),value:Math.round(x.count/max*100),count:x.count}));});
  constructor(){this.dashboard.load();}
  occupancy() {
    return Math.round((this.inpatient.occupiedBeds().length / this.inpatient.beds().length) * 100);
  }
  print() {
    window.print();
  }
  async exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
    const rows = [
      ['Metric', 'Value'],
      ['Patients', this.clinical.patients().length],
      ['Appointments', this.clinical.appointments().length],
      ['Admissions', this.inpatient.activeAdmissions().length],
      ['Revenue', this.operations.revenue()],
      ['Outstanding', this.operations.outstanding()],
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `carepoint-report-${this.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    } finally { this.exporting.set(false); }
  }
}
