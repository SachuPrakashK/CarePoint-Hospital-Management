import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SafeApiError } from '../../core/interceptors/api-error.interceptor';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { AuditEvent, AuditStore } from '../../core/services/audit.store';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  imports: [RouterLink, AppIcon, StatusBadge],
  templateUrl: './audit-details.html',
  styleUrl: './audit-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AuditStore);
  readonly dates = inject(AppDateTimeService);
  readonly event = signal<AuditEvent | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) throw { status: 404 } satisfies Partial<SafeApiError>;
      this.event.set(await this.store.get(id));
    } catch (error) {
      const status = (error as Partial<SafeApiError>)?.status;
      this.error.set(
        status === 404
          ? 'This audit event could not be found.'
          : 'Audit event details could not be loaded.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  label(value: string) {
    return value
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  metadata(value: unknown) {
    return value == null ? '' : JSON.stringify(value, null, 2);
  }
}
