import { inject } from '@angular/core'; import { CanActivateFn, Router } from '@angular/router'; import { AuthStore } from '../auth/auth.store'; import { Permission } from '../models/auth.models';
export const permissionGuard: CanActivateFn = route => inject(AuthStore).has(route.data['permission'] as Permission) || inject(Router).createUrlTree(['/forbidden']);
