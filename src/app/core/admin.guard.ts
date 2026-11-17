import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

function loginTree(router: Router) {
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: router.url },
  });
}

/**
 * Any live session. The shell then filters navigation down to the sections the
 * account may actually open, so `user`-level accounts only see Mods.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.hasValidSession() ? true : loginTree(router);
};

/** Live session plus a dynamic permission, for example `mods:read`. */
export const permissionGuard =
  (permission: string): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.hasValidSession()) {
      return loginTree(router);
    }
    return auth.can(permission) ? true : router.createUrlTree(['/forbidden']);
  };

/**
 * Live session plus the system `admin` role, used for the accounts, roles,
 * permissions and audit screens. Non-admins can view files but not manage
 * access.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.hasValidSession()) {
    return loginTree(router);
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/forbidden']);
};
