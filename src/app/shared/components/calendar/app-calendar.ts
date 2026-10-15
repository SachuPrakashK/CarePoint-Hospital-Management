import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

interface CalendarDay { iso: string; day: number; currentMonth: boolean; today: boolean; selected: boolean; }

@Component({
  selector: 'app-calendar',
  templateUrl: './app-calendar.html',
  styleUrl: './app-calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCalendar {
  readonly value = input('');
  readonly valueChange = output<string>();
  private readonly todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  readonly month = signal(this.startOfMonth(this.value() || this.todayIso));
  readonly heading = computed(() => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(this.month()));
  readonly days = computed<CalendarDay[]>(() => {
    const first = this.month();
    const start = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - first.getUTCDay()));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + index);
      const iso = date.toISOString().slice(0, 10);
      return { iso, day: date.getUTCDate(), currentMonth: date.getUTCMonth() === first.getUTCMonth(), today: iso === this.todayIso, selected: iso === this.value() };
    });
  });
  shift(delta: number) { const d = this.month(); this.month.set(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1))); }
  today() { this.month.set(this.startOfMonth(this.todayIso)); this.valueChange.emit(this.todayIso); }
  select(day: CalendarDay) { this.month.set(this.startOfMonth(day.iso)); this.valueChange.emit(day.iso); }
  private startOfMonth(iso: string) { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)); }
}
