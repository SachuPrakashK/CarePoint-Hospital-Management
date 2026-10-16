import { Component, computed, inject, input } from '@angular/core';
import { Phase23Store } from '../../../core/services/phase23.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
@Component({ templateUrl: './invoice-page.html', styleUrl: './invoice-page.scss' })
export class InvoicePage {
  id = input('');
  private store = inject(Phase23Store);
  private dates = inject(AppDateTimeService);
  invoice = computed(() => this.store.invoices().find((i) => i.id === this.id()));
  totals = computed(() => this.store.totals(this.id()));
  format(v: string) {
    return this.dates.formatDate(v);
  }
  print() {
    window.print();
  }
  back() {
    history.back();
  }
}
