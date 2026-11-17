import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { apiErrorMessage } from '../../core/api-error';
import { actorLabel } from '../../core/format';
import { ModFileActionDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PAGE_SIZE, withHasMore } from '../../core/pagination';
import { Pager } from '../../core/pager';
import { AuditService } from './audit.service';
import { HistoryDialog } from './history-dialog';

@Component({
  selector: 'app-audit-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    Pager,
  ],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage {
  private readonly audit = inject(AuditService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly filter = new FormControl('', { nonNullable: true });
  protected readonly rows = signal<ModFileActionDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly offset = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly activeFilter = signal<string | null>(null);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly actorLabel = actorLabel;

  constructor() {
    void this.load();
  }

  protected changePage(offset: number): void {
    this.offset.set(offset);
    void this.load();
  }

  protected applyFilter(): void {
    const value = this.filter.value.trim();
    this.activeFilter.set(value.length > 0 ? value : null);
    this.offset.set(0);
    void this.load();
  }

  protected clearFilter(): void {
    this.filter.setValue('');
    this.activeFilter.set(null);
    this.offset.set(0);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const limit = this.pageSize + 1;
      const filter = this.activeFilter();
      const result =
        filter === null
          ? await this.audit.actions(limit, this.offset())
          : await this.audit.history(filter, limit, this.offset());

      const page = withHasMore(result, this.pageSize);
      this.rows.set(page.rows);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected openHistory(fileName: string): void {
    this.dialog.open(HistoryDialog, {
      data: { fileName },
      width: '760px',
      maxWidth: '95vw',
    });
  }
}
