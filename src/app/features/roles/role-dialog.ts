import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { apiErrorMessage } from '../../core/api-error';
import { PermissionDto, RoleDto } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PermissionsService } from '../permissions/permissions.service';
import { RolesService } from './roles.service';

export interface RoleDialogData {
  role: RoleDto | null;
}

interface PermissionGroup {
  resource: string;
  permissions: PermissionDto[];
}

@Component({
  selector: 'app-role-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './role-dialog.html',
  styleUrl: './role-dialog.scss',
})
export class RoleDialog {
  protected readonly data = inject<RoleDialogData>(MAT_DIALOG_DATA);
  private readonly roles = inject(RolesService);
  private readonly permissions = inject(PermissionsService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject<MatDialogRef<RoleDialog, boolean>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly catalog = signal<PermissionDto[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly isEdit = this.data.role !== null;
  protected readonly isSystem = this.data.role?.is_system ?? false;

  protected readonly groups = computed<PermissionGroup[]>(() => {
    const grouped = new Map<string, PermissionDto[]>();
    for (const permission of this.catalog()) {
      const resource = permission.code.split(':')[0] ?? 'other';
      const list = grouped.get(resource) ?? [];
      list.push(permission);
      grouped.set(resource, list);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resource, permissions]) => ({ resource, permissions }));
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [
      this.data.role?.name ?? '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z0-9_-]+$/),
      ],
    ],
    description: [this.data.role?.description ?? '', [Validators.maxLength(255)]],
  });

  constructor() {
    if (this.isSystem) {
      this.form.controls.name.disable();
    }
    this.selected.set(new Set(this.data.role?.permissions.map((item) => item.code) ?? []));
    void this.loadCatalog();
  }

  protected isSelected(code: string): boolean {
    return this.selected().has(code);
  }

  protected toggle(code: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    this.selected.set(next);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const permissionCodes = [...this.selected()].sort();
    const description = value.description.trim();

    this.saving.set(true);
    try {
      if (this.data.role === null) {
        await this.roles.create({
          name: value.name.trim(),
          description: description.length > 0 ? description : null,
          permissions: permissionCodes,
        });
      } else {
        await this.roles.update(this.data.role.id, {
          name: this.isSystem ? undefined : value.name.trim(),
          description,
          permissions: permissionCodes,
        });
      }
      this.ref.close(true);
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadCatalog(): Promise<void> {
    try {
      this.catalog.set(await this.permissions.list());
    } catch (error: unknown) {
      this.notify.error(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
