import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Thin wrapper so pages do not repeat snackbar configuration. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'notify-success');
  }

  error(message: string): void {
    this.open(message, 'notify-error');
  }

  info(message: string): void {
    this.open(message, 'notify-info');
  }

  private open(message: string, panelClass: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 6000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass,
    });
  }
}
