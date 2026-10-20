import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guard';
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./login-page').then((m) => m.LoginPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./password-page').then((m) => m.PasswordPage),
    data: { mode: 'forgot' },
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./password-page').then((m) => m.PasswordPage),
    data: { mode: 'reset' },
  },
  {
    path: '**',
    data: { pageTitle: '404 - Page Not Found' },
    loadComponent: () =>
      import('../../shared/pages/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
