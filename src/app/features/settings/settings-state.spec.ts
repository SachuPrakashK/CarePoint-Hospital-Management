import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../core/auth/auth.store';
import { LanguageService } from '../../core/i18n/language.service';
import { ApplicationSettingsService } from '../../core/services/application-settings.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AdministrationApiService } from '../administration/administration-api.service';
import { SettingsState } from './settings-state';

describe('SettingsState translations', () => {
  it('persists, closes, reopens, and preserves edits after a failed save', async () => {
    let persisted: Record<string, string> = {
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
    };
    let failSave = false;
    const api = {
      setting: vi.fn(() => of({ data: {} })),
      logo: vi.fn(() => throwError(() => new Error('No optional logo'))),
      languages: vi.fn(() => of({ data: [] })),
      languageCatalog: vi.fn(() => of({ data: [] })),
      supportContacts: vi.fn(() => of({ data: {} })),
      supportArticles: vi.fn(() => of({ data: [] })),
      languageTranslations: vi.fn(() =>
        of({
          data: {
            code: 'fr',
            keys: ['common.save', 'common.cancel'],
            source: { 'common.save': 'Save', 'common.cancel': 'Cancel' },
            values: { ...persisted },
            totalKeys: 2,
            completedKeys: 2,
            missingKeys: 0,
            translationCoverage: 100,
          },
        }),
      ),
      saveLanguageTranslations: vi.fn((_id: string, values: Record<string, string>) => {
        if (failSave) return throwError(() => new Error('Save failed'));
        persisted = { ...persisted, ...values };
        return of({
          data: {
            values: persisted,
            updatedKeys: Object.keys(values),
            completedKeys: Object.keys(persisted).length,
            missingKeys: 0,
            translationCoverage: 100,
          },
        });
      }),
    };
    const language = {
      load: vi.fn(async () => true),
      enabled: signal([]),
      translate: (key: string) => key,
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        SettingsState,
        FormBuilder,
        { provide: AdministrationApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
        { provide: ApplicationSettingsService, useValue: { set: vi.fn() } },
        {
          provide: AuthStore,
          useValue: {
            user: signal({ roles: [{ code: 'HOSPITAL_ADMIN' }] }),
            has: vi.fn(() => false),
          },
        },
        { provide: LanguageService, useValue: language },
      ],
    });
    const state = TestBed.inject(SettingsState);
    const french = {
      id: 'language-fr',
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      enabled: true,
      translationCoverage: 0,
      isDefault: false,
    };

    await state.openTranslations(french);
    expect(state.translationValues()['common.save']).toBe('Enregistrer');
    expect(state.translationMode()).toBe('all');

    state.setTranslation('common.save', 'Sauvegarder');
    await state.saveTranslations();
    expect(api.saveLanguageTranslations).toHaveBeenCalledWith('language-fr', {
      'common.save': 'Sauvegarder',
    });
    expect(persisted['common.save']).toBe('Sauvegarder');
    expect(persisted['common.cancel']).toBe('Annuler');
    expect(state.translationLanguage()).toBeNull();
    expect(toast.success).toHaveBeenCalledOnce();

    await state.openTranslations(french);
    expect(state.translationValues()['common.save']).toBe('Sauvegarder');
    expect(state.translationValues()['common.cancel']).toBe('Annuler');

    failSave = true;
    state.setTranslation('common.save', 'Échec conservé');
    await state.saveTranslations();
    expect(state.translationLanguage()?.id).toBe('language-fr');
    expect(state.translationValues()['common.save']).toBe('Échec conservé');
    expect(state.translationsDirty()).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Translations could not be saved.');
  });
});
