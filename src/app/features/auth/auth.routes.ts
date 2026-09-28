import { Routes } from '@angular/router';
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadComponent: () => import('./login-page').then(m => m.LoginPage) },
  { path: 'sign-in', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', loadComponent: () => import('./register-page').then(m => m.RegisterPage) },
  { path: 'forgot-password', loadComponent: () => import('./password-page').then(m => m.PasswordPage), data: { mode: 'forgot' } },
  { path: 'reset-password', loadComponent: () => import('./password-page').then(m => m.PasswordPage), data: { mode: 'reset' } }
];
