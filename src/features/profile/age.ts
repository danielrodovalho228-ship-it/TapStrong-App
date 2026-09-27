/**
 * Age, body band and app mode — SPEC §5 (bands) and §8 (modes).
 *
 * Only birth month and year are known. When today is in the birth month we
 * cannot tell whether the birthday has passed, so we count it as not yet
 * reached. That errs toward the younger band, which is the safer side for the
 * child (under 13) and teen (under 18) rules.
 */

import { clock } from '@/lib/clock';
import { KIDS_MIN_AGE, kidsUnder13Enabled, minAge } from '@/lib/features';

export type BodyBand = 'kid' | 'teen' | 'young' | 'adult' | 'mid' | 'senior' | 'elder';
export type AppMode = 'child' | 'teen' | 'adult' | 'senior';

/** Lowest supported age with kids on (SPEC §5); see minAge() for the live one. */
export const MIN_AGE = KIDS_MIN_AGE;
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
  if (age < minAge()) return null;
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
  // A neutral age screen (store rule): the list never hints at the cut-off,
  // so with kids off it still reaches young ages and the gate says no.
  const newest = today.year - (kidsUnder13Enabled() ? MIN_AGE : 5);
  const oldest = today.year - MAX_AGE;
  const years: number[] = [];
  for (let y = newest; y >= oldest; y--) years.push(y);
  return years;
}

/** Recovery window in hours before a muscle returns to neutral (SPEC §4). */
export function recoveryHoursFor(mode: AppMode): number {
  return mode === 'senior' ? 96 : 72;
}
