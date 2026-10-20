import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { TRANSLATIONS } from './translations';
export interface AppLanguage {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  translationCoverage: number;
  isDefault: boolean;
}
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  readonly current = signal('en');
  readonly enabled = signal<AppLanguage[]>([
    {
      id: 'en',
      code: 'en',
      name: 'English',
      nativeName: 'English',
      enabled: true,
      translationCoverage: 100,
      isDefault: true,
    },
  ]);
  async load() {
    try {
      const [languages, preference] = await Promise.all([
        firstValueFrom(this.http.get<{ data: AppLanguage[] }>('/api/v1/languages')),
        firstValueFrom(this.http.get<{ data: AppLanguage | null }>('/api/v1/languages/preference')),
      ]);
      this.enabled.set(languages.data);
      const code = preference.data?.code ?? 'en';
      this.current.set(languages.data.some((x) => x.code === code) ? code : 'en');
      document.documentElement.lang = this.current();
    } catch {
      this.current.set('en');
      document.documentElement.lang = 'en';
    }
  }
  async select(code: string) {
    const previous = this.current();
    if (code === previous) return;
    try {
      await firstValueFrom(this.http.put('/api/v1/languages/preference', { code }));
      this.current.set(code);
      document.documentElement.lang = code;
    } catch {
      this.current.set(previous);
      this.toast.error('Language could not be changed.');
    }
  }
  translate(key: string) {
    return TRANSLATIONS[this.current()]?.[key] ?? TRANSLATIONS['en']?.[key] ?? key;
  }
}
