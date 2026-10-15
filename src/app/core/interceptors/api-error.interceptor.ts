import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../services/toast.service';
export interface SafeApiError {
  status: number;
  message: string;
  validationErrors?: Record<string, string[]>;
}
const messages: Record<number, string> = {
  400: 'The request could not be processed.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record was not found.',
  409: 'This change conflicts with an existing record.',
  422: 'Some information needs correction.',
  429: 'Too many requests. Please wait and try again.',
  500: 'Something went wrong on our side.',
  503: 'The service is temporarily unavailable.',
};
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  // Functional interceptors have an injection context only while the interceptor
  // function itself is executing. RxJS callbacks run later and must use captured
  // service references rather than calling inject() themselves.
  const toast = inject(ToastService);
  const auth = inject(AuthStore);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const sessionFailure =
        error.status === 401 && auth.authenticated() && !request.url.includes('/auth/login');
      const message =
        error.status === 0
          ? 'The service is unreachable. Check your connection.'
          : (messages[error.status] ?? 'An unexpected error occurred.');

      if (sessionFailure) {
        void auth.handleSessionExpiry();
      } else if (
        !request.headers.has('X-Handle-Error-Locally') &&
        !request.headers.has('X-Auth-Refresh') &&
        error.status !== 422
      ) {
        toast.error(message);
      }

      const safe: SafeApiError = {
        status: error.status,
        message,
        validationErrors:
          error.status === 422 && typeof error.error === 'object' ? error.error?.errors : undefined,
      };
      return throwError(() => safe);
    }),
  );
};
