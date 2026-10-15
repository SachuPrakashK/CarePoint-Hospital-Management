import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AppIcon } from '../icon/app-icon';
import { ActionsMenuService } from './actions-menu.service';

@Component({
  selector: 'app-actions-menu',
  imports: [AppIcon],
  templateUrl: './app-actions-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppActionsMenu {
  private readonly menus = inject(ActionsMenuService);
  readonly id = input.required<string>();
  readonly label = input('Record actions');
  readonly canDelete = input(true);
  readonly canView = input(true);
  readonly canEdit = input(true);
  readonly editDisabled = input(false);
  readonly editDisabledReason = input('This record cannot be edited.');
  readonly deleteLabel = input('Delete');
  readonly canStatus = input(false);
  readonly canReset = input(false);
  readonly statusLabel = input('Change Status');
  readonly view = output<void>();
  readonly edit = output<void>();
  readonly delete = output<void>();
  readonly statusChange = output<void>();
  readonly reset = output<void>();
  readonly position = signal({ top: 0, right: 0 });
  readonly activeId = this.menus.activeId;

  toggle(event: MouseEvent) {
    event.stopPropagation();
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.position.set({
      top:
        bounds.bottom + 136 > window.innerHeight
          ? Math.max(8, bounds.top - 132)
          : bounds.bottom + 6,
      right: Math.max(12, window.innerWidth - bounds.right),
    });
    this.menus.toggle(this.id());
  }
  choose(event: Event, action: 'view' | 'edit' | 'delete' | 'statusChange' | 'reset') {
    event.stopPropagation();
    if (action === 'edit' && this.editDisabled()) return;
    this.menus.close();
    this[action].emit();
  }
  @HostListener('document:click') closeOutside() {
    this.menus.close();
  }
  @HostListener('document:keydown.escape') closeOnEscape() {
    this.menus.close();
  }
}
