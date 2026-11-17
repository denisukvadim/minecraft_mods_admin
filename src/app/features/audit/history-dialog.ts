import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { apiErrorMessage } from '../../core/api-error';
import { actorLabel } from '../../core/format';
import { ModFileActionDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PAGE_SIZE, withHasMore } from '../../core/pagination';
import { Pager } from '../../core/pager';
import { AuditService } from './audit.service';

export interface HistoryDialogData {
  fileName: string;
}

@Component({
  selector: 'app-history-dialog',
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule, Pager],
  template: `
    <h2 mat-dialog-title>File history</h2>
    <mat-dialog-content>
      <p class="subtitle mono">{{ data.fileName }}</p>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td class="muted">{{ row.created_at | date: 'medium' }}</td>
                <td>
                  {{ actorLabel(row) }}
                  @if (row.username && row.user_email) {
                    <div class="muted small">{{ row.user_email }}</div>
                  }
                </td>
                <td>
                  <span class="chip" [class]="'chip chip--' + row.action">
                    {{ row.action }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3">
                  <div class="empty-state">
                    <mat-icon>history_toggle_off</mat-icon>
                    <p>
                      {{ loading() ? 'Loading history…' : 'No recorded actions for this file.' }}
                    </p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <app-pager
        [offset]="offset()"
        [count]="rows().length"
        [pageSize]="pageSize"
        [hasMore]="hasMore()"
        (changed)="changePage($event)"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle {
      margin: 0 0 12px;
    }
    .small {
      font-size: 12px;
    }
    .data-table td {
      padding: 10px 12px;
    }
    mat-dialog-content {
      padding-bottom: 0;
    }
  `,
})
export class HistoryDialog {
  protected readonly data = inject<HistoryDialogData>(MAT_DIALOG_DATA);
  private readonly audit = inject(AuditService);
  private readonly notify = inject(NotifyService);

  protected readonly rows = signal<ModFileActionDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly offset = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly actorLabel = actorLabel;

  constructor() {
    void this.load();
  }

  protected changePage(offset: number): void {
    this.offset.set(offset);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.audit.history(this.data.fileName, this.pageSize + 1, this.offset());
      const page = withHasMore(rows, this.pageSize);
      this.rows.set(page.rows);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
