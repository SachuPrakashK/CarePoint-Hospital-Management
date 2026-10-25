import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { AppIcon } from '../icon/app-icon';
import { SearchField } from '../search/search-field';

export interface MultiSelectOption {
  value: string;
  label: string;
  secondary?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-shared-multi-select',
  imports: [ClickOutsideDirective, AppIcon, SearchField],
  templateUrl: './shared-multi-select.html',
  styleUrl: './shared-multi-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedMultiSelect {
  readonly options = input.required<readonly MultiSelectOption[]>();
  readonly selected = input<readonly string[]>([]);
  readonly placeholder = input('Select options');
  readonly searchPlaceholder = input('Search options...');
  readonly selectedChange = output<string[]>();
  readonly open = signal(false);
  readonly search = signal('');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.options().filter(
      (option) =>
        !query ||
        option.label.toLocaleLowerCase().includes(query) ||
        option.secondary?.toLocaleLowerCase().includes(query) ||
        option.value.toLocaleLowerCase().includes(query),
    );
  });
  selectedOptions() {
    const values = new Set(this.selected());
    return this.options().filter((option) => values.has(option.value));
  }
  toggle(option: MultiSelectOption) {
    if (option.disabled) return;
    const values = this.selected();
    this.selectedChange.emit(
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  }
  remove(value: string, event: Event) {
    event.stopPropagation();
    this.selectedChange.emit(this.selected().filter((item) => item !== value));
  }
  clear() {
    this.selectedChange.emit([]);
  }
}
