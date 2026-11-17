import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { apiErrorMessage } from '../../core/api-error';
import { NotifyService } from '../../core/notify.service';
import { ServerService } from './server.service';

const REFRESH_MS = 5000;

@Component({
  selector: 'app-server-logs-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Server logs</h2>
    <mat-dialog-content>
      <div class="log-toolbar">
        <mat-form-field appearance="outline" class="tail-select" subscriptSizing="dynamic">
          <mat-label>Lines</mat-label>
          <mat-select [value]="tail()" (selectionChange)="changeTail($event.value)">
            @for (option of tailOptions; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-checkbox [checked]="autoRefresh()" (change)="autoRefresh.set($event.checked)">
          Auto-refresh
        </mat-checkbox>

        <span class="spacer"></span>

        @if (lastUpdated(); as updated) {
          <span class="muted small">Updated {{ updated | date: 'mediumTime' }}</span>
        }

        <button matIconButton type="button" matTooltip="Refresh" (click)="refresh()">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <pre class="logs">{{ content() }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .log-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .tail-select {
      width: 120px;
    }
    .small {
      font-size: 12px;
    }
    .logs {
      margin: 0;
      padding: 12px 14px;
      background: #11140f;
      color: #d7e6d2;
      border-radius: 12px;
      font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 60vh;
      overflow: auto;
      min-height: 120px;
    }
    mat-dialog-content {
      padding-bottom: 0;
    }
  `,
})
export class ServerLogsDialog {
  private readonly server = inject(ServerService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tailOptions = [100, 300, 1000];
  protected readonly content = signal('Loading…');
  protected readonly loading = signal(false);
  protected readonly autoRefresh = signal(true);
  protected readonly tail = signal(300);
  protected readonly lastUpdated = signal<Date | null>(null);

  constructor() {
    void this.refresh();

    // The dialog lives for a short while; poll while it is open and stop as
    // soon as it closes so no request keeps running in the background.
    const timer = setInterval(() => {
      if (this.autoRefresh()) {
        void this.refresh();
      }
    }, REFRESH_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected async refresh(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    try {
      const response = await this.server.logs(this.tail(), true);
      this.content.set(response.logs.trim().length > 0 ? response.logs : 'No output yet.');
      this.lastUpdated.set(new Date());
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected changeTail(tail: number): void {
    this.tail.set(tail);
    void this.refresh();
  }
}
