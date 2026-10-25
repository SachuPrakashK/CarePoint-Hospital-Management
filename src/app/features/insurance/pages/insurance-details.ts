import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  imports: [DatePipe, AppIcon, StatusBadge],
  templateUrl: './insurance-details.html',
  styleUrl: './insurance-details.scss',
})
export class InsuranceDetails {
  readonly kind = input.required<'claims' | 'policies' | 'providers'>();
  readonly id = input.required<string>();
  private readonly api = inject(Phase23ApiService);
  readonly item = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    queueMicrotask(() => void this.load());
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const request =
        this.kind() === 'claims'
          ? this.api.insuranceClaim(this.id())
          : this.kind() === 'policies'
            ? this.api.insurancePolicy(this.id())
            : this.api.insuranceProvider(this.id());
      this.item.set((await firstValueFrom(request)).data);
    } catch {
      this.error.set('Insurance details could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  patientName(patient: any) {
    return `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim() || '—';
  }
  money(value: unknown) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      Number(value ?? 0),
    );
  }
  relatedClaimCount(provider: any) {
    return (provider?.policies ?? []).reduce(
      (total: number, policy: any) => total + (policy.claims?.length ?? 0),
      0,
    );
  }
}
