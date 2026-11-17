import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-forbidden-page',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="forbidden">
      <div class="forbidden__panel">
        <mat-icon class="forbidden__icon">shield</mat-icon>
        <h1>Access denied</h1>
        <p>
          You are signed in as <strong>{{ auth.me()?.username }}</strong>, but this account does not
          have access to this section. Ask an administrator to grant the required permission, then
          sign in again.
        </p>
        <button matButton="filled" type="button" (click)="signOut()">Sign out</button>
      </div>
    </div>
  `,
  styles: `
    .forbidden {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .forbidden__panel {
      max-width: 440px;
      text-align: center;
      background: var(--mat-sys-surface, #fff);
      border: 1px solid var(--mat-sys-outline-variant, #e2e5dc);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .forbidden__icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--mat-sys-error, #ba1a1a);
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small, 500 24px/32px Roboto);
    }
    p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant, #44483f);
      line-height: 1.5;
    }
  `,
})
export class ForbiddenPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected signOut(): void {
    this.auth.logout(false);
    void this.router.navigate(['/login']);
  }
}
