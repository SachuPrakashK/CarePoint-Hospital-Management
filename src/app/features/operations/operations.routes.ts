import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
export const OPERATIONS_ROUTES: Routes = [
  ...(
    [
      ['inventory', 'inventory', 'inventory.view'],
      ['procurement', 'procurement', 'inventory.view'],
      ['suppliers', 'suppliers', 'inventory.view'],
      ['ambulance', 'ambulance', 'ambulance.view'],
    ] as const
  ).map(([path, kind, permission]) => ({
    path: `${path}/:id`,
    canActivate: [permissionGuard],
    data: { permission, kind },
    loadComponent: () =>
      import('./pages/operations-details').then((module) => module.OperationsDetails),
  })),
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: 'inventory.view' },
    loadComponent: () => import('./pages/operations-page').then((m) => m.OperationsPage),
  },
];
