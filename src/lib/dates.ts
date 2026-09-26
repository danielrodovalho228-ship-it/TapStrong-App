import { getCalendars } from 'expo-localization';

/** Local calendar dates as `YYYY-MM-DD`, for streaks and daily stats. */
export type LocalDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function localDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon: safe across DST changes
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Day index a week starts on: 0 = Sunday … 6 = Saturday. */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** First day of the date's calendar week. */
export function weekStart(date: LocalDate, startsOn: WeekStartDay = 0): LocalDate {
  const day = parse(date).getDay(); // 0 = Sunday
  return addDays(date, -((day - startsOn + 7) % 7));
}

/**
 * First day of the week from the phone's calendar settings; Sunday when the
 * device does not say (US launch — Daniel, Sep 2026).
 */
export function deviceWeekStart(): WeekStartDay {
  try {
    const first = getCalendars()[0]?.firstWeekday; // 1 = Sunday … 7 = Saturday
    return first && first >= 1 && first <= 7 ? ((first - 1) as WeekStartDay) : 0;
  } catch {
    return 0;
  }
}

export const HOUR_MS = 3_600_000;
