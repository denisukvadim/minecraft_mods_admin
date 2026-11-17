import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { apiErrorMessage } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** Dynamic permission needed to show the entry; admins see it regardless. */
  permission?: string;
  /** Shown only to the system `admin` role. */
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  private readonly allNavItems: NavItem[] = [
    { path: '/mods', label: 'Mods', icon: 'folder_open', permission: 'mods:read' },
    { path: '/users', label: 'Users', icon: 'group', adminOnly: true },
    { path: '/roles', label: 'Roles', icon: 'shield_person', adminOnly: true },
    { path: '/permissions', label: 'Permissions', icon: 'rule', adminOnly: true },
    { path: '/audit', label: 'Audit', icon: 'history', adminOnly: true },
  ];

  /** Only the sections the current account may open; `user` sees Mods alone. */
  protected readonly navItems = computed(() =>
    this.allNavItems.filter((item) =>
      item.adminOnly ? this.auth.isAdmin() : !item.permission || this.auth.can(item.permission),
    ),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: '/' },
  );

  protected readonly pageTitle = computed(
    () => this.navItems().find((item) => this.url().startsWith(item.path))?.label ?? 'Admin',
  );

  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected readonly navOpened = signal(true);

  constructor() {
    effect(() => this.navOpened.set(!this.isHandset()));

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (this.isHandset()) {
        this.navOpened.set(false);
      }
    });

    // Roles can be revoked without a re-login; refresh once per app start so
    // the sidebar and guards reflect the current access.
    void this.auth.refreshMe().catch((error: unknown) => {
      this.notify.error(apiErrorMessage(error));
    });
  }

  protected toggleNav(): void {
    this.navOpened.update((opened) => !opened);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
