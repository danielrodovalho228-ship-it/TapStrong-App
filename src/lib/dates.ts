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

/** Monday of the date's calendar week (ISO weeks start on Monday). */
export function weekStart(date: LocalDate): LocalDate {
  const day = parse(date).getDay(); // 0 = Sunday
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export const HOUR_MS = 3_600_000;
