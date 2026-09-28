import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
export const INPATIENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: 'admissions.view' },
    loadComponent: () => import('./pages/inpatient-page').then((m) => m.InpatientPage),
  },
  {
    path: 'new',
    canActivate: [permissionGuard],
    data: { permission: 'admissions.create' },
    loadComponent: () => import('./pages/admission-form').then((m) => m.AdmissionForm),
  },
  {
    path: 'discharge/:id',
    loadComponent: () => import('./pages/discharge-summary').then((m) => m.DischargeSummaryPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/admission-details').then((m) => m.AdmissionDetails),
  },
];
