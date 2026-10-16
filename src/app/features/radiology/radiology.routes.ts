import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
export const RADIOLOGY_ROUTES: Routes = [
  {
    path: ':id',
    canActivate: [permissionGuard],
    data: { permission: 'radiology.view' },
    loadComponent: () => import('./pages/radiology-details').then((m) => m.RadiologyDetails),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [permissionGuard],
    data: { permission: 'radiology.view' },
    loadComponent: () => import('./pages/radiology-page').then((m) => m.RadiologyPage),
  },
];
