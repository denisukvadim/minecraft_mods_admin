import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import { confirmAction } from '../../core/confirm-dialog';
import { formatBytes } from '../../core/format';
import { ModFileDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PAGE_SIZE, withHasMore } from '../../core/pagination';
import { Pager } from '../../core/pager';
import { HistoryDialog } from '../audit/history-dialog';
import { ModsService } from './mods.service';

@Component({
  selector: 'app-mods-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    Pager,
  ],
  templateUrl: './mods-page.html',
  styleUrl: './mods-page.scss',
})
export class ModsPage {
  private readonly mods = inject(ModsService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly files = signal<ModFileDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly offset = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly uploading = signal(false);
  protected readonly uploadPercent = signal(0);
  protected readonly uploadName = signal<string | null>(null);

  protected readonly formatBytes = formatBytes;

  constructor() {
    void this.load();
  }

  protected changePage(offset: number): void {
    this.offset.set(offset);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.mods.list(this.pageSize + 1, this.offset());
      const page = withHasMore(rows, this.pageSize);

      // Deleting the last row of the last page would leave an empty table.
      if (page.rows.length === 0 && this.offset() > 0) {
        this.offset.set(Math.max(0, this.offset() - this.pageSize));
        await this.load();
        return;
      }

      this.files.set(page.rows);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected pickFile(input: HTMLInputElement): void {
    if (!this.uploading()) {
      input.click();
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.uploadName.set(file.name);
    try {
      await this.mods.upload(file, (percent) => this.uploadPercent.set(percent));
      this.notify.success(`Uploaded ${file.name}`);
      this.offset.set(0);
      await this.load();
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.uploading.set(false);
      this.uploadName.set(null);
    }
  }

  protected async download(file: ModFileDto): Promise<void> {
    try {
      await this.mods.download(file.file_name);
      this.notify.success(`Downloading ${file.file_name}`);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }

  protected async remove(file: ModFileDto): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Delete mod file?',
      message: `“${file.file_name}” will be removed from the mods directory. The action is written to the audit log and cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.mods.remove(file.file_name);
      this.notify.success(`Deleted ${file.file_name}`);
      await this.load();
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }

  protected openHistory(file: ModFileDto): void {
    this.dialog.open(HistoryDialog, {
      data: { fileName: file.file_name },
      width: '760px',
      maxWidth: '95vw',
    });
  }
}
