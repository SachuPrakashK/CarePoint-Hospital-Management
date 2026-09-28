import { inject } from '@angular/core'; import { CanActivateFn, Router } from '@angular/router'; import { AuthStore } from '../auth/auth.store';
export const authGuard: CanActivateFn = (_, state) => { const auth = inject(AuthStore); return auth.authenticated() || inject(Router).createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } }); };
export const guestGuard: CanActivateFn = () => !inject(AuthStore).authenticated() || inject(Router).createUrlTree(['/dashboard']);
