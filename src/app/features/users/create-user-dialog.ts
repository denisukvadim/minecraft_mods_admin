import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { apiErrorMessage } from '../../core/api-error';
import { RoleDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { RolesService } from '../roles/roles.service';
import { UsersService } from './users.service';

@Component({
  selector: 'app-create-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>New user</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="off" />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <mat-error>A valid email is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="off" />
            @if (form.controls.username.touched && form.controls.username.invalid) {
              <mat-error>3–32 characters: letters, digits, “_”, “-”, “.”.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <mat-hint>8–128 characters. Share it with the user out of band.</mat-hint>
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <mat-error>Password must be 8–128 characters.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Roles</mat-label>
            <mat-select formControlName="roles" multiple>
              @for (role of roles(); track role.id) {
                <mat-option [value]="role.name">
                  {{ role.name }}
                  @if (role.is_system) {
                    <span class="muted"> · system</span>
                  }
                </mat-option>
              }
            </mat-select>
            <mat-hint>Defaults to “user”. Permissions come from the selected roles.</mat-hint>
          </mat-form-field>

          <div class="full">
            <mat-slide-toggle formControlName="isActive"> Account is active </mat-slide-toggle>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="saving()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          {{ saving() ? 'Creating…' : 'Create user' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      padding-top: 8px;
    }
  `,
})
export class CreateUserDialog {
  private readonly users = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject<MatDialogRef<CreateUserDialog, boolean>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly saving = signal(false);

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
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    roles: this.formBuilder.nonNullable.control<string[]>(['user']),
    isActive: true,
  });

  constructor() {
    void this.loadRoles();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.roles.length === 0) {
      this.notify.error('Select at least one role.');
      return;
    }

    this.saving.set(true);
    try {
      await this.users.create({
        email: value.email.trim(),
        username: value.username.trim(),
        password: value.password,
        roles: value.roles,
        is_active: value.isActive,
      });
      this.ref.close(true);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadRoles(): Promise<void> {
    try {
      this.roles.set(await this.rolesService.list());
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    }
  }
}
