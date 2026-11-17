import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { apiErrorMessage } from '../../core/api-error';
import { NotifyService } from '../../core/notify.service';
import { PermissionsService } from './permissions.service';

@Component({
  selector: 'app-permission-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>New permission</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <div class="stack">
          <mat-form-field appearance="outline">
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="mods:publish" autocomplete="off" />
            <mat-hint>
              Format <span class="mono">resource:action</span>, lowercase letters, digits, “_”, “-”,
              “.”, “:”.
            </mat-hint>
            @if (form.controls.code.touched && form.controls.code.invalid) {
              <mat-error>3–100 characters in the form “resource:action”.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Description (optional)</mat-label>
            <input matInput formControlName="description" autocomplete="off" />
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <mat-error>At most 255 characters.</mat-error>
            }
          </mat-form-field>

          <p class="hint">
            Creating a rule does not grant it to anybody. Attach it to a role or a user afterwards.
          </p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="saving()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          {{ saving() ? 'Creating…' : 'Create' }}
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
export class PermissionDialog {
  private readonly permissions = inject(PermissionsService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject<MatDialogRef<PermissionDialog, boolean>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100),
        Validators.pattern(/^[a-z0-9_.:-]+$/),
      ],
    ],
    description: ['', [Validators.maxLength(255)]],
  });

  protected async submit(): Promise<void> {
    const code = this.form.controls.code.value.trim().toLowerCase();
    if (!code.includes(':')) {
      this.form.controls.code.setErrors({ missingColon: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const description = this.form.controls.description.value.trim();
    this.saving.set(true);
    try {
      await this.permissions.create({
        code,
        description: description.length > 0 ? description : null,
      });
      this.ref.close(true);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
