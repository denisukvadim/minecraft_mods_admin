import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { apiErrorMessage } from '../../core/api-error';
import { confirmAction } from '../../core/confirm-dialog';
import { PermissionDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PermissionsService } from './permissions.service';
import { PermissionDialog } from './permission-dialog';

@Component({
  selector: 'app-permissions-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './permissions-page.html',
  styleUrl: './permissions-page.scss',
})
export class PermissionsPage {
  private readonly permissions = inject(PermissionsService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly rows = signal<PermissionDto[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.permissions.list());
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async create(): Promise<void> {
    const ref = this.dialog.open<PermissionDialog, void, boolean>(PermissionDialog, {
      width: '480px',
      maxWidth: '95vw',
    });
    if ((await firstValueFrom(ref.afterClosed())) === true) {
      this.notify.success('Permission created');
      await this.load();
    }
  }

  protected async remove(permission: PermissionDto): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Delete permission?',
      message: `“${permission.code}” will be removed from every role and from every user who has it directly. Endpoints checking this rule will deny access until it is created again.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.permissions.remove(permission.id);
      this.notify.success(`Deleted ${permission.code}`);
      await this.load();
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }
}
