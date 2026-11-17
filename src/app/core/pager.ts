import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Offset-based pager for endpoints that do not expose a total count: the
 * caller requests `pageSize + 1` rows to know whether a next page exists.
 */
@Component({
  selector: 'app-pager',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="pager">
      <span class="muted">{{ range() }}</span>
      <span class="spacer"></span>
      <button
        matIconButton
        [disabled]="offset() === 0"
        (click)="goPrevious()"
        aria-label="Previous page"
      >
        <mat-icon>chevron_left</mat-icon>
      </button>
      <button matIconButton [disabled]="!hasMore()" (click)="goNext()" aria-label="Next page">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid var(--mat-sys-outline-variant, #e2e5dc);
    }
  `,
})
export class Pager {
  readonly offset = input.required<number>();
  readonly count = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly hasMore = input.required<boolean>();
  readonly changed = output<number>();

  readonly range = computed(() => {
    const count = this.count();
    if (count === 0) {
      return 'No rows';
    }
    const offset = this.offset();
    return `Rows ${offset + 1}–${offset + count}`;
  });

  goPrevious(): void {
    this.changed.emit(Math.max(0, this.offset() - this.pageSize()));
  }

  goNext(): void {
    this.changed.emit(this.offset() + this.pageSize());
  }
}
