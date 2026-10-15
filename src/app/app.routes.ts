import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

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
        path: 'users',
        canActivate: [permissionGuard],
        data: { permission: 'users.view' },
        loadComponent: () => import('./features/users/user-page').then((m) => m.UserPage),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard],
        data: { permission: 'roles.view' },
        loadComponent: () =>
          import('./features/administration/roles-page').then((m) => m.RolesPage),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard],
        canDeactivate: [(component) => component.canLeave()],
        data: { permission: 'settings.view' },
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
      {path:'help-support',canActivate:[permissionGuard],data:{permission:'support.view'},loadComponent:()=>import('./features/support/help-support-page').then(m=>m.HelpSupportPage)},
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications-page').then((m) => m.NotificationsPage),
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
        path: 'doctors',
        canActivate: [permissionGuard],
        data: { permission: 'doctors.view', kind: 'doctors' },
        loadComponent: () =>
          import('./features/staff-directory/staff-page').then((m) => m.StaffPage),
      },
      {
        path: 'doctors/:id',
        canActivate: [permissionGuard],
        data: { permission: 'doctors.view', kind: 'doctors' },
        loadComponent: () =>
          import('./features/staff-directory/staff-details').then((m) => m.StaffDetails),
      },
      {
        path: 'employees',
        canActivate: [permissionGuard],
        data: { permission: 'employees.view', kind: 'employees' },
        loadComponent: () =>
          import('./features/staff-directory/staff-page').then((m) => m.StaffPage),
      },
      {
        path: 'employees/:id',
        canActivate: [permissionGuard],
        data: { permission: 'employees.view', kind: 'employees' },
        loadComponent: () =>
          import('./features/staff-directory/staff-details').then((m) => m.StaffDetails),
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
