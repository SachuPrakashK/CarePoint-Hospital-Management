import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../services/toast.service';
export interface SafeApiError{status:number;message:string;validationErrors?:Record<string,string[]>}
const messages:Record<number,string>={400:'The request could not be processed.',401:'Your session has expired. Please sign in again.',403:'You do not have permission to perform this action.',404:'The requested record was not found.',409:'This change conflicts with an existing record.',422:'Some information needs correction.',429:'Too many requests. Please wait and try again.',500:'Something went wrong on our side.',503:'The service is temporarily unavailable.'};
export const apiErrorInterceptor:HttpInterceptorFn=(request,next)=>next(request).pipe(catchError((error:HttpErrorResponse)=>{const toast=inject(ToastService),auth=inject(AuthStore),message=error.status===0?'The service is unreachable. Check your connection.':messages[error.status]??'An unexpected error occurred.';if(!request.headers.has('X-Handle-Error-Locally')&&error.status!==422)toast.error(message);if(error.status===401&&auth.authenticated())auth.logout();const safe:SafeApiError={status:error.status,message,validationErrors:error.status===422&&typeof error.error==='object'?error.error?.errors:undefined};return throwError(()=>safe)}));
