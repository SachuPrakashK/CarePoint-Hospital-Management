import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/services/toast.service';
import { AppModal } from '../../shared/components/modal/app-modal';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import {
  StaffDirectoryApiService,
  StaffKind,
  StaffOptions,
  StaffRecord,
} from './staff-directory-api.service';
import { StaffForm } from './staff-form';
@Component({
  imports: [StatusBadge, AppModal, StaffForm],
  templateUrl: './staff-details.html',
  styleUrl: './staff-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffDetails {
  private route = inject(ActivatedRoute);
  private api = inject(StaffDirectoryApiService);
  private toast = inject(ToastService);
  readonly auth = inject(AuthStore);
  readonly dates = inject(AppDateTimeService);
  readonly kind = this.route.snapshot.data['kind'] as StaffKind;
  readonly record = signal<StaffRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly options = signal<StaffOptions>({ departments: [], specializations: [], roles: [] });
  readonly editOpen = signal(false);
  readonly editLoading = signal(false);
  readonly dirty = signal(false);
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
  async edit() {
    if (this.editLoading()) return;
    this.editLoading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const [record, options] = await Promise.all([
        firstValueFrom(this.api.get(this.kind, id)),
        firstValueFrom(this.api.options(this.kind)),
      ]);
      this.record.set(record.data);
      this.options.set(options.data);
      this.dirty.set(false);
      this.editOpen.set(true);
    } catch {
      this.toast.error('Employee edit data could not be loaded.');
    } finally {
      this.editLoading.set(false);
    }
  }
  async saved() {
    this.editOpen.set(false);
    this.toast.success(`${this.kind === 'doctors' ? 'Doctor' : 'Employee'} updated.`);
    await this.load();
  }
}
