import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';
import { AppIcon } from '../../../shared/components/icon/app-icon';

@Component({
  imports: [RouterLink, StatusBadge, DisplayValuePipe, AppIcon],
  templateUrl: './radiology-details.html',
  styleUrl: './radiology-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadiologyDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(Phase23ApiService);
  readonly dates = inject(AppDateTimeService);
  readonly item = signal<any | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    const id = this.route.snapshot.paramMap.get('id');
    this.loading.set(true);
    this.error.set('');
    this.notFound.set(false);
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const response = await firstValueFrom(this.api.radiologyOrder(id));
      if (!response.data) this.notFound.set(true);
      else this.item.set(response.data);
    } catch (error: any) {
      if (error?.status === 404) this.notFound.set(true);
      else this.error.set('Unable to load the radiology order.');
    } finally {
      this.loading.set(false);
    }
  }
}
