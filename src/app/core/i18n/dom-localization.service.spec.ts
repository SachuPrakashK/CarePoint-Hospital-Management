import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DomLocalizationService } from './dom-localization.service';
import { LanguageService } from './language.service';
import { UI_CATALOG } from './ui-catalog';

describe('DomLocalizationService', () => {
  it('reactively translates existing and dynamically changed interface text', async () => {
    const current = signal('fr');
    const activeTranslations = signal<Record<string, string>>({ 'common.save': 'Enregistrer' });
    const language = {
      current,
      activeTranslations,
      translate: vi.fn((key: keyof typeof UI_CATALOG) =>
        current() === 'fr' ? (activeTranslations()[key] ?? UI_CATALOG[key]) : UI_CATALOG[key],
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageService, useValue: language }],
    });
    TestBed.inject(DomLocalizationService);
    const button = document.createElement('button');
    button.textContent = 'Save';
    button.title = 'Save';
    document.body.append(button);

    await vi.waitFor(() => expect(button.textContent).toBe('Enregistrer'));
    expect(button.title).toBe('Enregistrer');

    button.textContent = 'Saving...';
    await vi.waitFor(() => expect(button.textContent).toBe('Saving...'));

    button.textContent = 'Save';
    current.set('en');
    activeTranslations.set({});
    await vi.waitFor(() => expect(button.textContent).toBe('Save'));

    button.remove();
    TestBed.resetTestingModule();
  });
});
