/**
 * Age, body band and app mode — SPEC §5 (bands) and §8 (modes).
 *
 * Only birth month and year are known. When today is in the birth month we
 * cannot tell whether the birthday has passed, so we count it as not yet
 * reached. That errs toward the younger band, which is the safer side for the
 * child (under 13) and teen (under 18) rules.
 */

import { clock } from '@/lib/clock';

export type BodyBand = 'kid' | 'teen' | 'young' | 'adult' | 'mid' | 'senior' | 'elder';
export type AppMode = 'child' | 'teen' | 'adult' | 'senior';

export const MIN_AGE = 9;
export const MAX_AGE = 110;

export type YearMonth = { year: number; month: number }; // month 1–12

export function currentYearMonth(date = clock.now()): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function ageFrom(birth: YearMonth, today: YearMonth = currentYearMonth()): number {
  const years = today.year - birth.year;
  return today.month > birth.month ? years : years - 1;
}

export function bandForAge(age: number): BodyBand | null {
  if (age < MIN_AGE) return null;
  if (age <= 12) return 'kid';
  if (age <= 17) return 'teen';
  if (age <= 29) return 'young';
  if (age <= 44) return 'adult';
  if (age <= 59) return 'mid';
  if (age <= 74) return 'senior';
  return 'elder';
}

export function modeForAge(age: number): AppMode {
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  if (age >= 60) return 'senior';
  return 'adult';
}

/** Birth years offered in the age gate, newest first. */
export function birthYearOptions(today: YearMonth = currentYearMonth()): number[] {
  const newest = today.year - MIN_AGE;
  const oldest = today.year - MAX_AGE;
  const years: number[] = [];
  for (let y = newest; y >= oldest; y--) years.push(y);
  return years;
}

/** Recovery window in hours before a muscle returns to neutral (SPEC §4). */
export function recoveryHoursFor(mode: AppMode): number {
  return mode === 'senior' ? 96 : 72;
}
