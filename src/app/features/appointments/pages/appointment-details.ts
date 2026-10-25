import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppointmentApiService, ApiAppointment } from '../appointment-api.service';
import { AppDateTimePipe } from '../../../core/services/app-date-time.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  imports: [AppDateTimePipe, StatusBadge],
  templateUrl: './appointment-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AppointmentApiService);
  readonly appointment = signal<ApiAppointment | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set('Appointment was not found.');
      return;
    }
    this.api.get(id).subscribe({
      next: ({ data }) => {
        this.appointment.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load appointment.');
        this.loading.set(false);
      },
    });
  }
}
