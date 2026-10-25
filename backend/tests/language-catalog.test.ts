import { describe, expect, it } from 'vitest';
import { findCatalogLanguage, LANGUAGE_CATALOG } from '../src/data/language-catalog.js';

describe('standards-based language catalog', () => {
  it('contains a comprehensive alphabetically sorted catalog', () => {
    expect(LANGUAGE_CATALOG.length).toBeGreaterThan(180);
    const names = LANGUAGE_CATALOG.map(({ name }) => name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it.each([
    ['en', 'English'],
    ['fr', 'French'],
    ['zh-Hans', 'Chinese (Simplified)'],
  ])('resolves %s as %s', (code, name) => {
    const language = findCatalogLanguage(code);
    expect(language?.code).toBe(code);
    expect(language?.name).toBe(name);
    expect(language?.nativeName).toBeTruthy();
  });

  it.each(['hi', 'ml', 'ta'])('excludes retired language %s', (code) => {
    expect(findCatalogLanguage(code)).toBeUndefined();
  });

  it('rejects identifiers outside the managed catalog', () => {
    expect(findCatalogLanguage('not-a-language')).toBeUndefined();
  });
});
