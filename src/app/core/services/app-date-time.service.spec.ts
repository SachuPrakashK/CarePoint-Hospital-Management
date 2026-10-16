import { describe, expect, it } from 'vitest';
import { AppDateTimeService } from './app-date-time.service';

describe('AppDateTimeService', () => {
  const service = new AppDateTimeService();

  it('displays UTC timestamps in Asia/Kolkata', () => {
    expect(service.formatTime('2026-01-01T18:30:00.000Z')).toMatch(/12:00\s*am/i);
    expect(service.formatDate('2026-01-01T18:30:00.000Z')).toMatch(/02[\/-]01[\/-]2026/);
  });

  it('converts an IST form value to a UTC API timestamp', () => {
    expect(service.formValueToApi('2026-01-02', '00:00')).toBe('2026-01-01T18:30:00.000Z');
  });

  it('assigns UTC timestamps to the correct Asia/Kolkata calendar day', () => {
    expect(service.dateKey('2026-09-29T18:29:59.000Z')).toBe('2026-09-29');
    expect(service.dateKey('2026-09-29T18:30:00.000Z')).toBe('2026-09-30');
  });
});
