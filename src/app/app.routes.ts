import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./shared/components/message-page').then((m) => m.MessagePage),
    data: { code: '401', title: 'Session required', message: 'Please sign in to continue.' },
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./shared/components/message-page').then((m) => m.MessagePage),
    data: {
      code: '403',
      title: 'Access restricted',
      message: 'You do not have permission to view this page.',
    },
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'super-admins',
        loadComponent: () => import('./features/super-admins/super-admin-page').then((m) => m.SuperAdminPage),
      },
      {
        path: 'patients',
        loadChildren: () =>
          import('./features/patients/patient.routes').then((m) => m.PATIENT_ROUTES),
      },
      {
        path: 'appointments',
        loadChildren: () =>
          import('./features/appointments/appointment.routes').then((m) => m.APPOINTMENT_ROUTES),
      },
      {
        path: 'opd',
        loadChildren: () => import('./features/opd/opd.routes').then((m) => m.OPD_ROUTES),
      },
      {
        path: 'clinical',
        loadChildren: () =>
          import('./features/clinical/clinical.routes').then((m) => m.CLINICAL_ROUTES),
      },
      {
        path: 'laboratory',
        loadChildren: () =>
          import('./features/laboratory/laboratory.routes').then((m) => m.LABORATORY_ROUTES),
      },
      {
        path: 'radiology',
        loadChildren: () =>
          import('./features/radiology/radiology.routes').then((m) => m.RADIOLOGY_ROUTES),
      },
      {
        path: 'inpatient',
        loadChildren: () =>
          import('./features/inpatient/inpatient.routes').then((m) => m.INPATIENT_ROUTES),
      },
      {
        path: 'nursing',
        loadChildren: () =>
          import('./features/nursing/nursing.routes').then((m) => m.NURSING_ROUTES),
      },
      {
        path: 'procedures',
        loadChildren: () =>
          import('./features/procedures/procedure.routes').then((m) => m.PROCEDURE_ROUTES),
      },
      {
        path: 'pharmacy',
        loadChildren: () =>
          import('./features/pharmacy/pharmacy.routes').then((m) => m.PHARMACY_ROUTES),
      },
      {
        path: 'billing',
        loadChildren: () =>
          import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
      },
      {
        path: 'insurance',
        loadChildren: () =>
          import('./features/insurance/insurance.routes').then((m) => m.INSURANCE_ROUTES),
      },
      {
        path: 'operations',
        loadChildren: () =>
          import('./features/operations/operations.routes').then((m) => m.OPERATIONS_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/report.routes').then((m) => m.REPORT_ROUTES),
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./features/audit/audit-page').then((m) => m.AuditPage),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./features/documents/documents-page').then((m) => m.DocumentsPage),
      },
      {
        path: ':entity',
        loadChildren: () =>
          import('./features/administration/entity.routes').then((m) => m.ENTITY_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
