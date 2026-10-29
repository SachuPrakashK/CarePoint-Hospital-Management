import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AppIcon } from '../../shared/components/icon/app-icon';

@Component({
  selector: 'app-auth-language-selector',
  imports: [AppIcon],
  templateUrl: './auth-language-selector.html',
  styleUrl: './auth-language-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLanguageSelector {
  readonly language = inject(LanguageService);
  readonly open = signal(false);
  readonly selected = computed(
    () =>
      this.language.enabled().find((item) => item.code === this.language.current()) ??
      this.language.enabled()[0],
  );

  displayCode(code: string) {
    return code
      .split('-')
      .map((part, index) =>
        index === 0
          ? part.toUpperCase()
          : part.length === 4
            ? `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}`
            : part.toUpperCase(),
      )
      .join('-');
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    if (!this.language.loading() && this.language.enabled().length > 1)
      this.open.update((value) => !value);
  }

  select(code: string) {
    this.language.selectPublic(code);
    this.open.set(false);
  }

  @HostListener('document:click')
  close() {
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    this.open.set(false);
  }
}
