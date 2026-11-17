import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { MeResponse, TokenResponse } from './models';

const STORAGE_KEY = 'minecraft-mods-admin.session';

export interface Session {
  token: string;
  /** ISO timestamp from the backend, used to drop stale tokens. */
  expiresAt: string;
  me: MeResponse;
}

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'token' in parsed &&
      'expiresAt' in parsed &&
      'me' in parsed
    ) {
      const session = parsed as Session;
      if (new Date(session.expiresAt).getTime() > Date.now()) {
        return session;
      }
    }
  } catch {
    // A corrupt entry must not brick the app: fall through and clear it.
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly state = signal<Session | null>(readStoredSession());

  readonly session = this.state.asReadonly();
  readonly me = computed(() => this.state()?.me ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly isAdmin = computed(() => this.state()?.me.roles.includes('admin') ?? false);

  /**
   * Whether the panel is usable at all. Admins always are; other accounts need
   * the Mods section (`mods:read`), which is the only area they can open.
   */
  readonly canUsePanel = computed(
    () => this.isAdmin() || (this.state()?.me.permissions.includes('mods:read') ?? false),
  );

  /** Effective permission of the current session, used to gate UI affordances. */
  can(permission: string): boolean {
    return this.state()?.me.permissions.includes(permission) ?? false;
  }

  /** A token that has not expired yet; the backend still re-checks it. */
  hasValidSession(): boolean {
    const session = this.state();
    return session !== null && new Date(session.expiresAt).getTime() > Date.now();
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${environment.apiBaseUrl}/auth/login`, {
        email,
        password,
      }),
    );

    // The panel accepts administrators and accounts that can see the Mods
    // section. Verify before the token is kept so a valid but unrelated account
    // never reaches the shell.
    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${environment.apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${response.access_token}` },
      }),
    );

    if (!me.roles.includes('admin') && !me.permissions.includes('mods:read')) {
      throw new Error('This account does not have access to the admin panel.');
    }

    this.persist({
      token: response.access_token,
      expiresAt: response.expires_at,
      me,
    });
  }

  /**
   * Re-reads `/auth/me` so role changes apply without a re-login. The
   * interceptor clears the session on 401.
   */
  async refreshMe(): Promise<void> {
    if (!this.hasValidSession()) {
      return;
    }
    const me = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiBaseUrl}/auth/me`));
    const session = this.state();
    if (!session) {
      return;
    }
    if (!me.roles.includes('admin') && !me.permissions.includes('mods:read')) {
      this.clear();
      await this.router.navigate(['/forbidden']);
      return;
    }
    this.persist({ ...session, me });
  }

  logout(redirect = true): void {
    this.clear();
    if (redirect && !this.router.url.startsWith('/login')) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
    }
  }

  private persist(session: Session): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.state.set(session);
  }

  private clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state.set(null);
  }
}
