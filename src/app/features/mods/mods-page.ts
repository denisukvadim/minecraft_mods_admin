import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { apiErrorMessage, apiErrorStatus } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { confirmAction } from '../../core/confirm-dialog';
import { formatBytes } from '../../core/format';
import { ModFileDto, ServerStatusDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PAGE_SIZE, withHasMore } from '../../core/pagination';
import { Pager } from '../../core/pager';
import { HistoryDialog } from '../audit/history-dialog';
import { ServerLogsDialog } from '../server/server-logs-dialog';
import { ServerService } from '../server/server.service';
import { CreateUserDialog } from '../users/create-user-dialog';
import { ModsService } from './mods.service';

const STATUS_REFRESH_MS = 10_000;

type ServerAction = 'start' | 'stop' | 'restart';

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
  private readonly server = inject(ServerService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly files = signal<ModFileDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly offset = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly uploading = signal(false);
  protected readonly uploadPercent = signal(0);
  protected readonly uploadName = signal<string | null>(null);

  /** `null` until the first `/server/status` response arrives. */
  protected readonly serverStatus = signal<ServerStatusDto | null>(null);
  /** `false` when the backend has no Portainer integration (503). */
  protected readonly serverConfigured = signal(true);
  /** `true` when the state could not be read (Portainer down, network error). */
  protected readonly serverStatusUnknown = signal(false);
  protected readonly serverChecked = signal(false);
  protected readonly serverAction = signal<ServerAction | null>(null);

  protected readonly serverRunning = computed(() => this.serverStatus()?.running === true);

  protected readonly canUpload = computed(() => this.auth.can('mods:upload'));
  protected readonly canDelete = computed(() => this.auth.can('mods:delete'));
  protected readonly canDownload = computed(() => this.auth.can('mods:download'));
  protected readonly canManageServer = computed(() => this.auth.can('server:manage'));
  protected readonly canCreateUsers = computed(() => this.auth.can('users:create'));

  /**
   * Mod files may only change while the server is stopped. The backend enforces
   * the same rule; the UI mirrors it so the buttons explain themselves. Without
   * `server:manage` there is no state to read from the panel, so the backend
   * stays the only guard.
   */
  protected readonly canManageFiles = computed(
    () =>
      !this.canManageServer() ||
      (this.serverChecked() && !this.serverRunning() && !this.serverStatusUnknown()),
  );

  protected readonly serverStateLabel = computed(() => {
    if (!this.serverConfigured()) {
      return 'Not configured';
    }
    const status = this.serverStatus();
    if (!status) {
      return this.serverStatusUnknown() ? 'Status unavailable' : 'Checking…';
    }
    if (status.running) {
      return status.health ? `Running · ${status.health}` : 'Running';
    }
    return status.state === 'exited' ? 'Stopped' : status.state;
  });

  protected readonly formatBytes = formatBytes;

  constructor() {
    void this.load();

    // The server card and its polling are only for accounts that may control
    // the container; the backend still enforces the stopped-before-change rule
    // for everybody else.
    if (this.canManageServer()) {
      void this.refreshStatus(false);
      const timer = setInterval(() => void this.refreshStatus(), STATUS_REFRESH_MS);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    }
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

  /** Re-reads the container state; `quiet` suppresses polling noise. */
  protected async refreshStatus(quiet = true): Promise<void> {
    try {
      const status = await this.server.status();
      this.serverStatus.set(status);
      this.serverConfigured.set(true);
      this.serverStatusUnknown.set(false);
    } catch (error: unknown) {
      if (apiErrorStatus(error) === 503) {
        // Portainer is not configured: the rest of the page works as before.
        this.serverConfigured.set(false);
        this.serverStatus.set(null);
        this.serverStatusUnknown.set(false);
      } else {
        this.serverStatusUnknown.set(true);
        if (!quiet) {
          this.notify.error(apiErrorMessage(error));
        }
      }
    } finally {
      this.serverChecked.set(true);
    }
  }

  protected async runServerAction(action: ServerAction): Promise<void> {
    if (action !== 'start') {
      const confirmed = await confirmAction(this.dialog, {
        title: action === 'stop' ? 'Stop the Minecraft server?' : 'Restart the Minecraft server?',
        message:
          action === 'stop'
            ? 'Players will be disconnected. The world is saved and mod file changes become available; the container stays down until you start it again.'
            : 'Players will be disconnected while the container restarts and loads the current mod files.',
        confirmLabel: action === 'stop' ? 'Stop server' : 'Restart server',
        destructive: action === 'stop',
      });
      if (!confirmed) {
        return;
      }
    }

    this.serverAction.set(action);
    try {
      const status =
        action === 'start'
          ? await this.server.start()
          : action === 'stop'
            ? await this.server.stop()
            : await this.server.restart();
      this.serverStatus.set(status);
      this.serverConfigured.set(true);
      this.serverStatusUnknown.set(false);
      this.notify.success(`Server ${action} requested`);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.serverAction.set(null);
      await this.refreshStatus();
    }
  }

  protected openLogs(): void {
    this.dialog.open(ServerLogsDialog, {
      width: '900px',
      maxWidth: '95vw',
    });
  }

  /**
   * Available to any account holding `users:create`. The dialog hides role
   * selection for non-admins; the backend copies the creator's access instead.
   */
  protected async createUser(): Promise<void> {
    const ref = this.dialog.open<CreateUserDialog, void, boolean>(CreateUserDialog, {
      width: '560px',
      maxWidth: '95vw',
    });
    const created = await firstValueFrom(ref.afterClosed());
    if (created === true) {
      this.notify.success('User created with your access');
    }
  }

  protected pickFile(input: HTMLInputElement): void {
    if (!this.canUpload()) {
      this.notify.info('This account cannot upload mod files.');
      return;
    }
    if (this.uploading()) {
      return;
    }
    if (!this.canManageFiles()) {
      this.notify.info('Stop the Minecraft server before changing mod files.');
      return;
    }
    input.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!this.canUpload()) {
      this.notify.info('This account cannot upload mod files.');
      return;
    }
    if (!this.canManageFiles()) {
      this.notify.info('Stop the Minecraft server before changing mod files.');
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
    if (!this.canDownload()) {
      this.notify.info('This account cannot download mod files.');
      return;
    }
    try {
      await this.mods.download(file.file_name);
      this.notify.success(`Downloading ${file.file_name}`);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }

  protected async remove(file: ModFileDto): Promise<void> {
    if (!this.canDelete()) {
      this.notify.info('This account cannot delete mod files.');
      return;
    }
    if (!this.canManageFiles()) {
      this.notify.info('Stop the Minecraft server before changing mod files.');
      return;
    }

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
