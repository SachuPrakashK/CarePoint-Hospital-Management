import { describe, expect, it } from 'vitest';
import { formatStatus } from './status-badge';
describe('formatStatus', () => {
  it('formats enum labels with every underscore removed', () => expect(formatStatus('CHECKED_IN')).toBe('CHECKED IN'));
  it('normalizes multiple separators and casing', () => expect(formatStatus('  sample__collected ')).toBe('SAMPLE COLLECTED'));
  it('uses a safe label for missing statuses', () => expect(formatStatus(undefined)).toBe('UNKNOWN'));
});
