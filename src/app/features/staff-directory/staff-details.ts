import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { StaffDirectoryApiService, StaffKind, StaffRecord } from './staff-directory-api.service';
@Component({
  imports: [RouterLink, StatusBadge],
  templateUrl: './staff-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffDetails {
  private route = inject(ActivatedRoute);
  private api = inject(StaffDirectoryApiService);
  readonly dates = inject(AppDateTimeService);
  readonly kind = this.route.snapshot.data['kind'] as StaffKind;
  readonly record = signal<StaffRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.record.set(
        (await firstValueFrom(this.api.get(this.kind, this.route.snapshot.paramMap.get('id')!)))
          .data,
      );
    } catch (e: any) {
      this.error.set(
        e?.status === 404
          ? this.kind === 'doctors'
            ? 'Doctor not found.'
            : 'Employee not found.'
          : 'Unable to load this record.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
