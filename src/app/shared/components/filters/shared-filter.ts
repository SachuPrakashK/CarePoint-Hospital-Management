import { ChangeDetectionStrategy, Component, HostListener, input, output, signal } from '@angular/core';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { AppIcon } from '../icon/app-icon';

export type FilterValue = string | number | boolean | readonly (string | number | boolean)[] | null;
export type FilterType = 'select' | 'multi-select' | 'date' | 'date-range' | 'boolean' | 'text';
export interface FilterOption { value: string | number | boolean; label: string; }
export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  placeholder?: string;
  options?: readonly FilterOption[];
  disabled?: boolean;
}

@Component({
  selector: 'app-shared-filter',
  imports: [ClickOutsideDirective, AppIcon],
  templateUrl: './shared-filter.html',
  styleUrl: './shared-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedFilter {
  readonly activeCount = input(0);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly applyDisabled = input(false);
  readonly label = input('Filters');
  readonly applied = output<void>();
  readonly cleared = output<void>();
  readonly open = signal(false);

  toggle() {
    if (!this.disabled() && !this.loading()) this.open.update((value) => !value);
  }
  apply() {
    if (this.loading() || this.applyDisabled()) return;
    this.open.set(false);
    this.applied.emit();
  }
  clear() {
    if (this.loading()) return;
    this.open.set(false);
    this.cleared.emit();
  }
  @HostListener('document:keydown.escape')
  close() { this.open.set(false); }
}
