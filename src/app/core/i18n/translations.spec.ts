import { TRANSLATIONS } from './translations';
describe('translation resources', () => {
  it('ships English as the only built-in fallback pack', () => {
    const keys = Object.keys(TRANSLATIONS['en'] ?? {}).sort();
    expect(keys.length).toBeGreaterThan(1000);
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
  it('contains a unique English source label for every generated key', () => {
    const values = Object.values(TRANSLATIONS['en']);
    expect(new Set(values).size).toBe(values.length);
  });
  it('preserves representative Unicode labels without mojibake', () => {
    const values = Object.values(TRANSLATIONS['en']);
    for (const expected of ['Creating…', 'Updating…', 'Saving…', '₹', '×', '·', '→'])
      expect(values).toContain(expected);
    expect(values).toContain('View your organization’s configured support contacts.');
  });
});
