import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
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
  private lastEmitted = '';
  constructor() {
    this.changes.pipe(
      debounceTime(this.debounce()),
      map((value) => value.trim().replace(/\s+/g, ' ')),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((value) => {
      if (value === this.lastEmitted) return;
      this.lastEmitted = value;
      this.valueChange.emit(value);
    });
  }
  update(value: string) {
    this.current.set(value);
    this.changes.next(value);
  }
  clear(input: HTMLInputElement) {
    input.value = '';
    this.current.set('');
    this.changes.next('');
    this.lastEmitted = '';
    this.valueChange.emit('');
    input.focus();
  }
}
