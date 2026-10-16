export const APP_TIME_ZONE = 'Asia/Kolkata';

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsAt(date: Date, timeZone = APP_TIME_ZONE): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function zonedDateTimeToUtc(target: DateTimeParts, timeZone = APP_TIME_ZONE): Date {
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  let candidate = targetEpoch;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(new Date(candidate), timeZone);
    const actualEpoch = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate += targetEpoch - actualEpoch;
  }
  return new Date(candidate);
}

export function calendarDayBounds(
  instant = new Date(),
  timeZone = APP_TIME_ZONE,
): { start: Date; end: Date } {
  const local = partsAt(instant, timeZone);
  const following = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return {
    start: zonedDateTimeToUtc({ ...local, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateTimeToUtc(
      {
        year: following.getUTCFullYear(),
        month: following.getUTCMonth() + 1,
        day: following.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    ),
  };
}

export function calendarDateBounds(
  calendarDate: string,
  timeZone = APP_TIME_ZONE,
): { start: Date; end: Date } {
  const pieces = calendarDate.split('-');
  const year = Number(pieces[0]);
  const month = Number(pieces[1]);
  const day = Number(pieces[2]);
  const following = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateTimeToUtc(
      {
        year: following.getUTCFullYear(),
        month: following.getUTCMonth() + 1,
        day: following.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    ),
  };
}

export function calendarRangeBounds(
  startDate?: string,
  endDate?: string,
  timeZone = APP_TIME_ZONE,
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (startDate) range.gte = calendarDateBounds(startDate, timeZone).start;
  if (endDate) range.lt = calendarDateBounds(endDate, timeZone).end;
  return range;
}
