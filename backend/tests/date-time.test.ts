import { describe, expect, it } from 'vitest';
import { calendarDayBounds } from '../src/utils/date-time.js';

describe('Asia/Kolkata calendar day boundaries', () => {
  it('uses the prior UTC date before midnight IST', () => {
    const bounds = calendarDayBounds(new Date('2026-01-01T18:29:59.000Z'));
    expect(bounds.start.toISOString()).toBe('2025-12-31T18:30:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-01-01T18:30:00.000Z');
  });

  it('moves to the next IST day exactly at midnight', () => {
    const bounds = calendarDayBounds(new Date('2026-01-01T18:30:00.000Z'));
    expect(bounds.start.toISOString()).toBe('2026-01-01T18:30:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-01-02T18:30:00.000Z');
  });
});
