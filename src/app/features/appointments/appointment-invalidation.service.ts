import { inject, Injectable } from '@angular/core';
import { DashboardInvalidationService } from '../../core/services/dashboard-invalidation.service';
@Injectable({ providedIn: 'root' })
export class AppointmentInvalidationService {
  private dashboard = inject(DashboardInvalidationService);
  readonly changed = this.dashboard.changed;
  notify() {
    this.dashboard.invalidate('appointment');
  }
}
