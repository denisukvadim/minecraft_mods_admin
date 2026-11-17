import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { PermissionDto, RoleDto, UpdateUserRequest, UserDetail } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UsersService } from './users.service';

export interface ManageUserData {
  userId: string;
}

@Component({
  selector: 'app-manage-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTabsModule,
  ],
  templateUrl: './manage-user-dialog.html',
  styleUrl: './manage-user-dialog.scss',
})
export class ManageUserDialog {
  protected readonly data = inject<ManageUserData>(MAT_DIALOG_DATA);
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject<MatDialogRef<ManageUserDialog, boolean>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly detail = signal<UserDetail | null>(null);
  protected readonly allRoles = signal<RoleDto[]>([]);
  protected readonly allPermissions = signal<PermissionDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly changed = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(32),
        Validators.pattern(/^[A-Za-z0-9_.-]+$/),
      ],
    ],
    password: ['', [Validators.minLength(8), Validators.maxLength(128)]],
    isActive: true,
  });

  constructor() {
    void this.init();
  }

  protected isSelf(): boolean {
    return this.data.userId === this.auth.me()?.id;
  }

  protected close(): void {
    this.ref.close(this.changed());
  }

  protected async saveProfile(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: UpdateUserRequest = {
      email: value.email.trim(),
      username: value.username.trim(),
      is_active: value.isActive,
    };
    if (value.password.length > 0) {
      payload.password = value.password;
    }

    this.busy.set(true);
    try {
      const updated = await this.users.update(this.data.userId, payload);
      this.applyDetail(updated);
      this.changed.set(true);
      this.notify.success('Profile updated');
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected isRoleAssigned(role: RoleDto): boolean {
    return this.detail()?.roles.some((item) => item.id === role.id) ?? false;
  }

  protected async toggleRole(role: RoleDto, assigned: boolean): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      if (assigned) {
        await this.users.assignRole(this.data.userId, role.id);
      } else {
        await this.users.revokeRole(this.data.userId, role.id);
      }
      this.changed.set(true);
      this.applyDetail(await this.users.get(this.data.userId));
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
      await this.reloadDetail();
    } finally {
      this.busy.set(false);
    }
  }

  protected isPermissionGranted(permission: PermissionDto): boolean {
    return this.detail()?.direct_permissions.some((item) => item.id === permission.id) ?? false;
  }

  protected async togglePermission(permission: PermissionDto, granted: boolean): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      if (granted) {
        await this.users.grantPermission(this.data.userId, permission.id);
      } else {
        await this.users.revokePermission(this.data.userId, permission.id);
      }
      this.changed.set(true);
      this.applyDetail(await this.users.get(this.data.userId));
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
      await this.reloadDetail();
    } finally {
      this.busy.set(false);
    }
  }

  private async init(): Promise<void> {
    try {
      const [detail, roles, permissions] = await Promise.all([
        this.users.get(this.data.userId),
        this.rolesService.list(),
        this.permissionsService.list(),
      ]);
      this.allRoles.set(roles);
      this.allPermissions.set(permissions);
      this.applyDetail(detail);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadDetail(): Promise<void> {
    try {
      this.applyDetail(await this.users.get(this.data.userId));
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }

  private applyDetail(detail: UserDetail): void {
    this.detail.set(detail);
    this.form.reset({
      email: detail.email,
      username: detail.username,
      password: '',
      isActive: detail.is_active,
    });
  }
}
