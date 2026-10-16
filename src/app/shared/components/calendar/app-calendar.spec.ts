import { describe, expect, it, vi } from 'vitest';
import { AppCalendar } from './app-calendar';
import { TestBed } from '@angular/core/testing';

describe('AppCalendar', () => {
  it('creates a stable six-week grid and emits selected dates', () => {
    const calendar = TestBed.runInInjectionContext(() => new AppCalendar());
    expect(calendar.days()).toHaveLength(42);
    const emitted = vi.fn();
    calendar.valueChange.subscribe(emitted);
    calendar.select(calendar.days()[10]);
    expect(emitted).toHaveBeenCalledWith(calendar.days().find((day) => day.selected)?.iso ?? expect.any(String));
  });

  it('moves between calendar months', () => {
    const calendar = TestBed.runInInjectionContext(() => new AppCalendar());
    const before = calendar.heading();
    calendar.shift(1);
    expect(calendar.heading()).not.toBe(before);
  });
});
