import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
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
export class AppActionsMenu implements OnDestroy {
  private readonly menus = inject(ActionsMenuService);
  @ViewChild('trigger', { read: ElementRef }) private trigger?: ElementRef<HTMLElement>;
  private menu?: ElementRef<HTMLElement>;
  @ViewChild('menu', { read: ElementRef })
  private set menuElement(value: ElementRef<HTMLElement> | undefined) {
    this.menu = value;
    if (value && this.activeId() === this.id()) {
      queueMicrotask(() => {
        this.updatePosition();
        value.nativeElement.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
      });
    }
  }
  readonly id = input.required<string>();
  readonly label = input('Record actions');
  readonly canDelete = input(true);
  readonly canView = input(true);
  readonly canEdit = input(true);
  readonly editDisabled = input(false);
  readonly editDisabledReason = input('This record cannot be edited.');
  readonly editLabel = input('Edit');
  readonly deleteLabel = input('Delete');
  readonly canStatus = input(false);
  readonly canReset = input(false);
  readonly canPrint = input(false);
  readonly canPayment = input(false);
  readonly canDefault = input(false);
  readonly defaultLabel = input('Set as default');
  readonly statusLabel = input('Change Status');
  readonly view = output<void>();
  readonly edit = output<void>();
  readonly delete = output<void>();
  readonly statusChange = output<void>();
  readonly reset = output<void>();
  readonly print = output<void>();
  readonly payment = output<void>();
  readonly setDefault = output<void>();
  readonly position = signal({ top: 8, left: 8, maxHeight: 320 });
  readonly activeId = this.menus.activeId;
  private readonly reposition = () => {
    if (this.activeId() === this.id()) this.updatePosition();
  };

  constructor() {
    document.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.menus.toggle(this.id());
  }

  private updatePosition() {
    const origin = this.trigger?.nativeElement;
    const menu = this.menu?.nativeElement;
    if (!origin || !origin.isConnected) {
      this.menus.close();
      return;
    }
    if (!menu) return;

    const viewportPadding = 8;
    const gap = 6;
    const originRect = origin.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    const availableBelow = window.innerHeight - originRect.bottom - gap - viewportPadding;
    const availableAbove = originRect.top - gap - viewportPadding;
    const openAbove = menuHeight > availableBelow && availableAbove > availableBelow;
    const maxHeight = Math.max(96, openAbove ? availableAbove : availableBelow);
    const idealTop = openAbove
      ? originRect.top - Math.min(menuHeight, maxHeight) - gap
      : originRect.bottom + gap;
    const idealLeft = originRect.right - menuWidth;

    this.position.set({
      top: Math.max(viewportPadding, Math.min(idealTop, window.innerHeight - viewportPadding)),
      left: Math.max(
        viewportPadding,
        Math.min(idealLeft, window.innerWidth - menuWidth - viewportPadding),
      ),
      maxHeight,
    });
  }
  choose(
    event: Event,
    action:
      'view' | 'edit' | 'delete' | 'statusChange' | 'reset' | 'print' | 'payment' | 'setDefault',
  ) {
    event.stopPropagation();
    if (action === 'edit' && this.editDisabled()) return;
    this.menus.close();
    this[action].emit();
  }
  @HostListener('document:click') closeOutside() {
    this.menus.close();
  }
  @HostListener('document:keydown.escape') closeOnEscape() {
    if (this.activeId() === this.id()) {
      this.menus.close();
      this.trigger?.nativeElement.focus();
    }
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
    if (this.activeId() === this.id()) this.menus.close();
  }
}
