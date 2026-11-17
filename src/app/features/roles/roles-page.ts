import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { apiErrorMessage } from '../../core/api-error';
import { confirmAction } from '../../core/confirm-dialog';
import { RoleDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { RoleDialog } from './role-dialog';
import { RolesService } from './roles.service';

@Component({
  selector: 'app-roles-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage {
  private readonly roles = inject(RolesService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly rows = signal<RoleDto[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.roles.list());
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async edit(role: RoleDto | null): Promise<void> {
    const ref = this.dialog.open<RoleDialog, { role: RoleDto | null }, boolean>(RoleDialog, {
      data: { role },
      width: '720px',
      maxWidth: '95vw',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved === true) {
      this.notify.success(role === null ? 'Role created' : 'Role updated');
      await this.load();
    }
  }

  protected async remove(role: RoleDto): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Delete role?',
      message: `“${role.name}” will be removed from every user that has it. Its permission set is deleted with it; accounts keep their other roles and direct grants.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.roles.remove(role.id);
      this.notify.success(`Deleted role ${role.name}`);
      await this.load();
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }
}
