import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
export const INSURANCE_ROUTES: Routes = [
  {
    path: ':kind/:id',
    canActivate: [permissionGuard],
    data: { permission: 'insurance.view' },
    loadComponent: () => import('./pages/insurance-details').then((m) => m.InsuranceDetails),
  },
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: 'insurance.view' },
    loadComponent: () => import('./pages/insurance-page').then((m) => m.InsurancePage),
  },
];
