import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Guards every panel route: a live token is required, and the account must
 * still carry the `admin` role. Non-admins are sent to a dedicated page
 * instead of the login form, because their credentials are valid.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.hasValidSession()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: router.url },
    });
  }
  if (!auth.isAdmin()) {
    return router.createUrlTree(['/forbidden']);
  }
  return true;
};
