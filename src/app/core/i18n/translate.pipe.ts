import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from './language.service';
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private language = inject(LanguageService);
  transform(key: string, params: Record<string, string | number> = {}) {
    return this.language.translate(key, params);
  }
}
