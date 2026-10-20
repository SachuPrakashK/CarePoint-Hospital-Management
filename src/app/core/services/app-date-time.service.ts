import { inject, Injectable, Optional, Pipe, PipeTransform } from '@angular/core';
import { ApplicationSettingsService } from './application-settings.service';
import { LanguageService } from '../i18n/language.service';

export const APP_TIME_ZONE = 'Asia/Kolkata';

@Injectable({ providedIn: 'root' })
export class AppDateTimeService {
  constructor(
    @Optional() private settings?: ApplicationSettingsService,
    @Optional() private language?: LanguageService,
  ) {}
  private locale() {
    return (
      ({ en: 'en-IN', hi: 'hi-IN', ml: 'ml-IN', ta: 'ta-IN' } as Record<string, string>)[
        this.language?.current() ?? 'en'
      ] ?? 'en-IN'
    );
  }
  private configuration() {
    return (
      this.settings?.value() ?? {
        dateFormat: 'DD-MM-YYYY' as const,
        timeFormat: '12-hour' as const,
        timezone: APP_TIME_ZONE,
      }
    );
  }
  dateKey(value: string | Date): string {
    const item = this.parts(value instanceof Date ? value : new Date(value));
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${item.year}-${pad(item.month)}-${pad(item.day)}`;
  }
  formatDate(value: string | Date | null | undefined): string {
    const formats = {
      'DD-MM-YYYY': { day: '2-digit', month: '2-digit', year: 'numeric' },
      'MM-DD-YYYY': { month: '2-digit', day: '2-digit', year: 'numeric' },
      'YYYY-MM-DD': { year: 'numeric', month: '2-digit', day: '2-digit' },
    } as const;
    return this.format(value, formats[this.configuration().dateFormat]);
  }

  formatTime(value: string | Date | null | undefined): string {
    return this.format(value, {
      timeStyle: 'short',
      hour12: this.configuration().timeFormat === '12-hour',
    });
  }

  formatDateTime(value: string | Date | null | undefined): string {
    return this.format(value, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: this.configuration().timeFormat === '12-hour',
    });
  }

  relativeTime(value: string | Date): string {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    const relative = new Intl.RelativeTimeFormat(this.locale(), { numeric: 'auto' });
    if (seconds < 60) return relative.format(0, 'second');
    if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), 'hour');
    if (seconds < 172800) return relative.format(-1, 'day');
    return this.formatDate(value);
  }

  today(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.configuration().timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts();
    const part = (name: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === name)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  formDateTime(value: Date = new Date()): string {
    const item = this.parts(value);
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${item.year}-${pad(item.month)}-${pad(item.day)}T${pad(item.hour)}:${pad(item.minute)}`;
  }

  formValueToApi(date: string, time: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute, 0);
    let candidate = target;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const values = this.parts(new Date(candidate));
      const actual = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute,
        values.second,
      );
      candidate += target - actual;
    }
    return new Date(candidate).toISOString();
  }

  formDateTimeToApi(value: string): string {
    const [date, time] = value.split('T');
    return this.formValueToApi(date, time);
  }

  calculateAge(dateOfBirth: string): number {
    const [birthYear, birthMonth, birthDay] = dateOfBirth.slice(0, 10).split('-').map(Number);
    const [year, month, day] = this.today().split('-').map(Number);
    let age = year - birthYear;
    if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
    return Math.max(0, age);
  }

  private format(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.locale(), {
      ...options,
      timeZone: this.configuration().timezone,
    }).format(date);
  }

  private parts(date: Date) {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.configuration().timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (name: Intl.DateTimeFormatPartTypes) =>
      Number(formatted.find((item) => item.type === name)?.value);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
      second: value('second'),
    };
  }
}

@Pipe({ name: 'appDateTime', standalone: true, pure: false })
export class AppDateTimePipe implements PipeTransform {
  private readonly dates = inject(AppDateTimeService);
  transform(
    value: string | Date | null | undefined,
    mode: 'date' | 'time' | 'datetime' = 'datetime',
  ) {
    return mode === 'date'
      ? this.dates.formatDate(value)
      : mode === 'time'
        ? this.dates.formatTime(value)
        : this.dates.formatDateTime(value);
  }
}
