import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DashboardStore } from './dashboard.store';
import { OperationalWorkloadChart } from './components/operational-workload-chart/operational-workload-chart';
import { AppointmentsDepartmentChart } from './components/appointments-department-chart/appointments-department-chart';
import { AppointmentStatusChart } from './components/appointment-status-chart/appointment-status-chart';
import { ChartEmptyState } from '../../shared/components/chart-empty-state/chart-empty-state';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppDateTimePipe } from '../../core/services/app-date-time.service';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';

@Component({
  imports: [
    RouterLink,
    OperationalWorkloadChart,
    AppointmentsDepartmentChart,
    AppointmentStatusChart,
    ChartEmptyState,
    AppIcon,
    AppDateTimePipe,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  readonly store = inject(DashboardStore);
  private readonly router = inject(Router);
  ngOnInit() {
    this.store.load();
  }
  viewAppointment(id: string) {
    void this.router.navigate(['/appointments', id]);
  }
}
