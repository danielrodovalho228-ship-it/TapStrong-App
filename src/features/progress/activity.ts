import { addDays, localDate, weekStart, type LocalDate, type WeekStartDay } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import type { LoadUnit, WorkoutRecord } from '../workout/types';

import { countsAsWorkout, workoutMinutes } from './stats';

/**
 * Progress → Activity (improvements v1, D1): totals for a range, the month
 * calendar and an exercise's best load against a goal. Mobility sessions are
 * counted apart from workouts.
 */
export type ActivityRange = '7d' | '30d' | '6m' | '12m' | 'all';
const DAYS: Record<ActivityRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '6m': 183,
  '12m': 365,
  all: null,
};
const LB = 0.45359237;
const finished = (w: WorkoutRecord) =>
  (w.status === 'done' || w.status === 'partial') && w.logs.length > 0;

export function inRange(w: WorkoutRecord, range: ActivityRange, now: Date): boolean {
  const days = DAYS[range];
  if (days === null) return true;
  return now.getTime() - Date.parse(w.endedAt ?? w.createdAt) <= days * 86_400_000;
}

export function activityTotals(
  workouts: WorkoutRecord[],
  range: ActivityRange,
  now: Date,
  unit: LoadUnit,
) {
  const list = workouts.filter((w) => finished(w) && inRange(w, range, now));
  const regular = list.filter(countsAsWorkout);
  const minutes = regular.reduce((n, w) => n + workoutMinutes(w, now), 0);
  const volumeKg = regular.reduce(
    (n, w) =>
      n +
      w.logs.reduce(
        (m, l) => m + (l.load && l.reps ? (l.unit === 'lb' ? l.load * LB : l.load) * l.reps : 0),
        0,
      ),
    0,
  );
  return {
    workouts: regular.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    volume: Math.round(unit === 'lb' ? volumeKg / LB : volumeKg),
    mobility: list.filter((w) => w.kind === 'mobility').length,
  };
}

/** Days of a month with a finished workout or mobility session. */
export function trainedDays(workouts: WorkoutRecord[], month: string): Set<LocalDate> {
  return new Set(
    workouts
      .filter(finished)
      .map((w) => localDate(new Date(w.endedAt ?? w.createdAt)))
      .filter((d) => d.startsWith(month)),
  );
}

/** Weeks of a month as rows of dates (null outside the month), from the phone's week start. */
export function monthGrid(month: string, startsOn: WeekStartDay): (LocalDate | null)[][] {
  const first = `${month}-01`;
  const rows: (LocalDate | null)[][] = [];
  let d = weekStart(first, startsOn);
  while (rows.length < 6) {
    const row = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(d, i);
      return date.startsWith(month) ? date : null;
    });
    if (row.every((x) => x === null) && rows.length) break;
    rows.push(row);
    d = addDays(d, 7);
  }
  return rows;
}

/** Best load per session for one exercise, oldest first, in the person's unit. */
export function exerciseBest(workouts: WorkoutRecord[], exerciseId: string, unit: LoadUnit) {
  const points = workouts
    .filter(finished)
    .map((w) => {
      const kg = Math.max(
        0,
        ...w.logs
          .filter((l) => l.exerciseId === exerciseId && l.load)
          .map((l) => (l.unit === 'lb' ? l.load! * LB : l.load!)),
      );
      return {
        date: w.endedAt ?? w.createdAt,
        best: kg ? Math.round((unit === 'lb' ? kg / LB : kg) * 2) / 2 : 0,
      };
    })
    .filter((p) => p.best > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return { points, max: points.length ? Math.max(...points.map((p) => p.best)) : 0 };
}

/** Exercises with a logged load, for the graph picker. */
export function loggedExercises(workouts: WorkoutRecord[], library: Exercise[]): Exercise[] {
  const ids = new Set(
    workouts.filter(finished).flatMap((w) => w.logs.filter((l) => l.load).map((l) => l.exerciseId)),
  );
  return library.filter((e) => ids.has(e.id));
}
