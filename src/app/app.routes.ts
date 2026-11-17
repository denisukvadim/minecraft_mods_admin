import { Routes } from '@angular/router';

import { adminGuard, authGuard, permissionGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Mods Admin',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'forbidden',
    title: 'Access denied · Mods Admin',
    loadComponent: () => import('./features/forbidden/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: '',
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mods' },
      {
        path: 'mods',
        title: 'Mods · Mods Admin',
        data: { title: 'Mods' },
        canActivate: [permissionGuard('mods:read')],
        loadComponent: () => import('./features/mods/mods-page').then((m) => m.ModsPage),
      },
      {
        path: 'users',
        title: 'Users · Mods Admin',
        data: { title: 'Users' },
        canActivate: [adminGuard],
        loadComponent: () => import('./features/users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        title: 'Roles · Mods Admin',
        data: { title: 'Roles' },
        canActivate: [adminGuard],
        loadComponent: () => import('./features/roles/roles-page').then((m) => m.RolesPage),
      },
      {
        path: 'permissions',
        title: 'Permissions · Mods Admin',
        data: { title: 'Permissions' },
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/permissions/permissions-page').then((m) => m.PermissionsPage),
      },
      {
        path: 'audit',
        title: 'Audit · Mods Admin',
        data: { title: 'Audit' },
        canActivate: [adminGuard],
        loadComponent: () => import('./features/audit/audit-page').then((m) => m.AuditPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
