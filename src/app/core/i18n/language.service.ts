import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
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
  translationAvailable?: boolean;
  translationStatus?: 'AVAILABLE' | 'REQUIRED';
  translations?: { key: string; value: string }[];
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
  readonly runtimeTranslations = signal<Record<string, Record<string, string>>>({});
  readonly loading = signal(false);
  readonly selecting = signal(false);
  readonly loadError = signal(false);
  readonly missingKeys = signal<string[]>([]);
  readonly activeTranslations = computed(() => this.runtimeTranslations()[this.current()] ?? {});
  private readonly preferenceKey = 'medicare.language';

  async loadPublic() {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: AppLanguage[] }>('/api/v1/languages/public'),
      );
      this.applyLanguages(response.data, this.savedCode());
      this.loadError.set(false);
      return true;
    } catch {
      this.applyLanguage('en');
      this.loadError.set(true);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async load() {
    this.loading.set(true);
    try {
      const [languages, preference] = await Promise.all([
        firstValueFrom(this.http.get<{ data: AppLanguage[] }>('/api/v1/languages')),
        firstValueFrom(this.http.get<{ data: AppLanguage | null }>('/api/v1/languages/preference')),
      ]);
      const saved = this.savedCode();
      const code = languages.data.some((item) => item.code === saved)
        ? saved
        : (preference.data?.code ?? 'en');
      this.applyLanguages(languages.data, code);
      if (code !== preference.data?.code)
        await firstValueFrom(this.http.put('/api/v1/languages/preference', { code }));
      this.loadError.set(false);
      return true;
    } catch {
      this.applyLanguage('en');
      this.loadError.set(true);
      return false;
    } finally {
      this.loading.set(false);
    }
  }
  async select(code: string) {
    const previous = this.current();
    if (code === previous || this.selecting()) return;
    if (!this.enabled().some((language) => language.code === code && language.enabled)) {
      this.applyLanguage('en');
      this.toast.error('This language is no longer available. English has been restored.');
      return;
    }
    this.selecting.set(true);
    try {
      await firstValueFrom(this.http.put('/api/v1/languages/preference', { code }));
      this.applyLanguage(code);
    } catch {
      this.applyLanguage(previous);
      this.toast.error('Language could not be changed.');
    } finally {
      this.selecting.set(false);
    }
  }

  selectPublic(code: string) {
    if (!this.enabled().some((language) => language.code === code && language.enabled)) {
      this.applyLanguage('en');
      return;
    }
    this.applyLanguage(code);
  }

  private applyLanguages(languages: AppLanguage[], requestedCode: string) {
    const safeLanguages = languages.filter((language) => language.enabled);
    this.enabled.set(safeLanguages);
    this.runtimeTranslations.set(
      Object.fromEntries(
        safeLanguages.map((language) => [
          language.code,
          Object.fromEntries((language.translations ?? []).map((item) => [item.key, item.value])),
        ]),
      ),
    );
    this.applyLanguage(
      safeLanguages.some((language) => language.code === requestedCode) ? requestedCode : 'en',
    );
  }

  private savedCode() {
    try {
      return localStorage.getItem(this.preferenceKey) || 'en';
    } catch {
      return 'en';
    }
  }

  private applyLanguage(code: string) {
    this.current.set(code);
    document.documentElement.lang = code;
    document.documentElement.dir = code.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(this.preferenceKey, code);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }
  translate(key: string, params: Record<string, string | number> = {}) {
    const value =
      this.runtimeTranslations()[this.current()]?.[key] ??
      TRANSLATIONS[this.current()]?.[key] ??
      TRANSLATIONS['en']?.[key] ??
      key;
    if (value === key && !this.missingKeys().includes(key))
      this.missingKeys.update((keys) => [...keys, key]);
    return value.replace(/\{\{?\s*([\w.-]+)\s*\}?\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
  }
}
