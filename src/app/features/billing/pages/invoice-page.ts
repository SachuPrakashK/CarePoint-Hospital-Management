import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';

@Component({ templateUrl: './invoice-page.html', styleUrl: './invoice-page.scss' })
export class InvoicePage {
  readonly id = input('');
  private readonly api = inject(Phase23ApiService);
  private readonly dates = inject(AppDateTimeService);
  readonly invoice = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly totals = computed(() => {
    const invoice = this.invoice();
    return {
      total: Number(invoice?.total ?? 0),
      paid: Number(invoice?.paidAmount ?? 0),
      balance: Number(invoice?.balance ?? 0),
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string) {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.api.invoice(id));
      this.invoice.set(response.data);
      if (new URLSearchParams(window.location.search).get('print') === '1') {
        window.setTimeout(() => window.print(), 100);
      }
    } catch {
      this.invoice.set(null);
      this.error.set('Invoice details could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  patientName(patient: any) {
    return `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim();
  }
  format(value: string) {
    return this.dates.formatDate(value);
  }
  money(value: unknown) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(Number(value ?? 0));
  }
  print() {
    window.print();
  }
  back() {
    history.back();
  }
}
