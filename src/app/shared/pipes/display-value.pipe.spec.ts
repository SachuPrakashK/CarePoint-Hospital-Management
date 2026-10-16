import { describe, expect, it } from 'vitest';
import { DisplayValuePipe } from './display-value.pipe';

describe('DisplayValuePipe', () => {
  const pipe = new DisplayValuePipe();

  it('uses the fallback only for missing and blank values', () => {
    expect(pipe.transform(null)).toBe('Not available');
    expect(pipe.transform(undefined)).toBe('Not available');
    expect(pipe.transform('   ')).toBe('Not available');
    expect(pipe.transform([])).toBe('Not available');
  });

  it('formats populated clinical arrays without losing values', () => {
    expect(pipe.transform(['Penicillin', 'Latex'])).toBe('Penicillin, Latex');
  });

  it('preserves valid falsey clinical values', () => {
    expect(pipe.transform(0)).toBe(0);
    expect(pipe.transform(false)).toBe(false);
  });

  it('supports a compact custom fallback', () => {
    expect(pipe.transform('', '—')).toBe('—');
  });
});
