/**
 * Age, body band and app mode — SPEC §5 (bands) and §8 (modes).
 *
 * Usually only birth month and year are known. When the day is known, it
 * decides; otherwise someone whose birthday is this month gets the benefit of
 * the month and counts as having had it (QA R3-01) — nobody is held a year
 * younger for up to 30 days.
 */

import { clock } from '@/lib/clock';
import { KIDS_MIN_AGE, kidsUnder13Enabled, minAge } from '@/lib/features';

export type BodyBand = 'kid' | 'teen' | 'young' | 'adult' | 'mid' | 'senior' | 'elder';
export type AppMode = 'child' | 'teen' | 'adult' | 'senior';

/** Lowest supported age with kids on (SPEC §5); see minAge() for the live one. */
export const MIN_AGE = KIDS_MIN_AGE;
export const MAX_AGE = 110;

export type YearMonth = { year: number; month: number; day?: number }; // month 1–12

export function currentYearMonth(date = clock.now()): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function ageFrom(birth: YearMonth, today: YearMonth = currentYearMonth()): number {
  const years = today.year - birth.year;
  if (today.month !== birth.month) return today.month > birth.month ? years : years - 1;
  // Birthday month: the day decides when both are known, otherwise the month counts.
  if (birth.day != null && today.day != null) return today.day >= birth.day ? years : years - 1;
  return years;
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

/** Hours before a muscle's dots turn white again (recovered, SPEC §4). */
export function recoveryHoursFor(mode: AppMode): number {
  return mode === 'senior' ? 96 : 72;
}
