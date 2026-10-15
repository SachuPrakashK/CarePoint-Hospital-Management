import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { AppointmentForm } from './appointment-form';

@Component({ selector: 'app-appointment-create-page', imports: [AppModal, AppointmentForm], templateUrl: './appointment-create-page.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class AppointmentCreatePage {
  private readonly router = inject(Router);
  close() { void this.router.navigateByUrl('/appointments'); }
  created() { void this.router.navigateByUrl('/appointments'); }
}
