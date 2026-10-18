import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { AppIcon } from '../icon/app-icon';

@Component({
  selector: 'app-modal',
  imports: [AppIcon],
  templateUrl: './app-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppModal {
  private readonly confirmation = inject(ConfirmationService);
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input('');
  readonly size = input<'sm' | 'compact' | 'md' | 'lg' | 'xl'>('md');
  readonly dirty = input(false);
  readonly closed = output<void>();

  async requestClose() {
    if (
      this.dirty() &&
      !(await this.confirmation.confirm({
        title: 'Discard unsaved changes?',
        message: 'Your unsaved changes will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      }))
    )
      return;
    this.closed.emit();
  }
}
