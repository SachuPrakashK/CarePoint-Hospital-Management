import { TRANSLATIONS } from './translations';
describe('translation resources', () => {
  it('ships English as the only built-in fallback pack', () => {
    const keys = Object.keys(TRANSLATIONS['en'] ?? {}).sort();
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(TRANSLATIONS)).toEqual(['en']);
    for (const code of ['hi', 'ml', 'ta']) expect(TRANSLATIONS[code]).toBeUndefined();
  });
  it('contains no blank translations or raw-key values', () => {
    for (const pack of Object.values(TRANSLATIONS))
      for (const [key, value] of Object.entries(pack)) {
        expect(value.trim()).not.toBe('');
        expect(value).not.toBe(key);
      }
  });
});
