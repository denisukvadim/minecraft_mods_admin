import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { confirmAction } from '../../core/confirm-dialog';
import { UserSummary } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PAGE_SIZE, withHasMore } from '../../core/pagination';
import { Pager } from '../../core/pager';
import { CreateUserDialog } from './create-user-dialog';
import { ManageUserDialog } from './manage-user-dialog';
import { UsersService } from './users.service';

@Component({
  selector: 'app-users-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule, RouterLink, Pager],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly rows = signal<UserSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly offset = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly currentUserId = () => this.auth.me()?.id ?? null;

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
      const result = await this.users.list(this.pageSize + 1, this.offset());
      const page = withHasMore(result, this.pageSize);
      this.rows.set(page.rows);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async createUser(): Promise<void> {
    const ref = this.dialog.open<CreateUserDialog, void, boolean>(CreateUserDialog, {
      width: '560px',
      maxWidth: '95vw',
    });
    const created = await firstValueFrom(ref.afterClosed());
    if (created === true) {
      this.notify.success('User created');
      this.offset.set(0);
      await this.load();
    }
  }

  protected async manage(user: UserSummary): Promise<void> {
    const ref = this.dialog.open<ManageUserDialog, { userId: string }, boolean>(ManageUserDialog, {
      data: { userId: user.id },
      width: '760px',
      maxWidth: '95vw',
    });
    const changed = await firstValueFrom(ref.afterClosed());
    if (changed === true) {
      await this.load();
    }
  }

  protected async remove(user: UserSummary): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Delete user?',
      message: `${user.username} (${user.email}) will lose access immediately. Audit rows keep the action but lose the identity, because the account no longer exists.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.users.remove(user.id);
      this.notify.success(`Deleted ${user.username}`);
      await this.load();
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }
}
