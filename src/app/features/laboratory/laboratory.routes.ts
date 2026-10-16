import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
export const LABORATORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [permissionGuard],
    data: { permission: 'laboratory.view' },
    loadComponent: () => import('./pages/laboratory-page').then((m) => m.LaboratoryPage),
  },
  {
    path: ':id',
    canActivate: [permissionGuard],
    data: { permission: 'laboratory.view' },
    loadComponent: () => import('./pages/laboratory-details').then((m) => m.LaboratoryDetails),
  },
];
