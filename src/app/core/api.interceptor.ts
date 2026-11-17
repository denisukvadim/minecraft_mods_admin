import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Adds the bearer token to API calls and reacts to an expired token by
 * dropping the session. The login call is exempt: a 401 there means bad
 * credentials, not an expired session.
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isApiCall = request.url.startsWith(environment.apiBaseUrl);
  const token = auth.token();

  const authorized =
    token !== null && isApiCall
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiCall &&
        !request.url.endsWith('/auth/login')
      ) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
