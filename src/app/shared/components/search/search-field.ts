import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppIcon } from '../icon/app-icon';
@Component({
  selector: 'app-search-field',
  imports: [AppIcon],
  templateUrl: './search-field.html',
  styleUrl: './search-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField {
  placeholder = input('Search');
  label = input('Search');
  value = input('');
  disabled = input(false);
  debounce = input(300);
  valueChange = output<string>();
  readonly current = signal('');
  private readonly changes = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    this.changes.pipe(debounceTime(this.debounce()), takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.valueChange.emit(value));
  }
  update(value: string) {
    this.current.set(value);
    this.changes.next(value);
  }
  clear(input: HTMLInputElement) {
    input.value = '';
    this.current.set('');
    this.valueChange.emit('');
    input.focus();
  }
}
