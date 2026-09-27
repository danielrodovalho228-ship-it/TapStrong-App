import { addDays, weekStart, type LocalDate, type WeekStartDay } from '@/lib/dates';

import type { WorkoutRecord } from '../workout/types';

/**
 * Week strip (improvements v1, A1): the 7 days of this calendar week, each
 * marked trained (a finished workout or mobility session), planned (a day
 * the plan sets aside) or neither.
 */
export type DayMark = 'trained' | 'planned' | null;
export type WeekDay = { date: LocalDate; mark: DayMark; today: boolean };

/**
 * Which weekday offsets (0 = the week's first day) a plan of N days uses,
 * spread with rest between them. Deterministic.
 */
const SPREAD: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function plannedOffsets(daysPerWeek: number): number[] {
  return SPREAD[Math.max(1, Math.min(7, Math.round(daysPerWeek)))];
}

const finishedOn = (w: WorkoutRecord, date: LocalDate, toLocal: (iso: string) => LocalDate) =>
  (w.status === 'done' || w.status === 'partial') &&
  w.logs.length > 0 &&
  toLocal(w.endedAt ?? w.createdAt) === date;

export function weekStrip(input: {
  today: LocalDate;
  startsOn: WeekStartDay;
  daysPerWeek: number;
  workouts: WorkoutRecord[];
  toLocal: (iso: string) => LocalDate;
}): WeekDay[] {
  const first = weekStart(input.today, input.startsOn);
  const planned = new Set(plannedOffsets(input.daysPerWeek));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(first, i);
    const trained = input.workouts.some((w) => finishedOn(w, date, input.toLocal));
    return {
      date,
      today: date === input.today,
      mark: trained ? 'trained' : planned.has(i) && date >= input.today ? 'planned' : null,
    };
  });
}

/** Finished workouts on a day (the day view's log). */
export function workoutsOn(
  workouts: WorkoutRecord[],
  date: LocalDate,
  toLocal: (iso: string) => LocalDate,
): WorkoutRecord[] {
  return workouts.filter((w) => finishedOn(w, date, toLocal));
}
