import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';

/**
 * Self-service password change for the signed-in account. The backend verifies
 * the current password before writing the new hash, so a stolen token alone
 * cannot lock the owner out.
 */
@Component({
  selector: 'app-change-password-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Change password</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Current password</mat-label>
            <input
              matInput
              type="password"
              formControlName="current"
              autocomplete="current-password"
            />
            @if (form.controls.current.touched && form.controls.current.hasError('required')) {
              <mat-error>Current password is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>New password</mat-label>
            <input matInput type="password" formControlName="next" autocomplete="new-password" />
            <mat-hint>8–128 characters.</mat-hint>
            @if (form.controls.next.touched && form.controls.next.invalid) {
              <mat-error>Use 8–128 characters.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Confirm new password</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.controls.confirm.touched && form.controls.confirm.hasError('required')) {
              <mat-error>Repeat the new password.</mat-error>
            }
          </mat-form-field>

          <p class="hint full">
            Existing sessions stay signed in: tokens already issued remain valid until they expire.
          </p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="saving()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Change password' }}
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
export class ChangePasswordDialog {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject<MatDialogRef<ChangePasswordDialog, boolean>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirm: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.next !== value.confirm) {
      this.notify.error('The new passwords do not match.');
      return;
    }

    this.saving.set(true);
    try {
      await this.auth.changePassword(value.current, value.next);
      this.ref.close(true);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
