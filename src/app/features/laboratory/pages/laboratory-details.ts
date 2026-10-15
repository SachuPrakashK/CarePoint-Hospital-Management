import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { AppDateTimePipe } from '../../../core/services/app-date-time.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';

@Component({
  imports: [RouterLink, AppDateTimePipe, EmptyState, StatusBadge, DisplayValuePipe],
  templateUrl: './laboratory-details.html',
})
export class LaboratoryDetails {
  readonly id = input.required<string>();
  private readonly api = inject(Phase23ApiService);
  readonly order = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    effect(() => void this.load(this.id()));
  }

  async load(id = this.id()) {
    this.loading.set(true);
    this.error.set('');
    try {
      this.order.set((await firstValueFrom(this.api.labOrder(id))).data);
    } catch {
      this.order.set(null);
      this.error.set('Laboratory order could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
