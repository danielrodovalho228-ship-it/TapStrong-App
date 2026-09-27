import { addDays, localDate, weekStart, type WeekStartDay } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import { muscleFamily } from '../muscles';
import type { WorkoutRecord } from '../workout/types';

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';

/** A finished workout with work logged; short mobility sessions don't count. */
export const countsAsWorkout = (w: WorkoutRecord) =>
  finished(w) && w.logs.length > 0 && w.kind !== 'mobility';

const mainItemIds = (w: WorkoutRecord) =>
  new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));

/** Totals for the Progress header (mockup 18). */
export function totals(workouts: WorkoutRecord[]) {
  // A short mobility session keeps the streak but is not a workout (QA R3-05).
  const done = workouts.filter((w) => countsAsWorkout(w));
  return {
    workouts: done.length,
    sets: done.reduce((n, w) => {
      const main = mainItemIds(w);
      return n + w.logs.filter((l) => main.has(l.itemId)).length;
    }, 0),
  };
}

export type WeekBar = { weekStart: string; sets: number };

/**
 * Main-work sets per calendar week for a muscle (and its parts), the last
 * `weeks` weeks ending with the current one.
 */
export function weeklySets(
  workouts: WorkoutRecord[],
  library: Exercise[],
  muscle: string,
  now: Date,
  startsOn: WeekStartDay,
  weeks = 4,
): WeekBar[] {
  const family = new Set(muscleFamily(muscle));
  const byId = new Map(library.map((e) => [e.id, e]));
  const current = weekStart(localDate(now), startsOn);
  const bars: WeekBar[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(current, -7 * (weeks - 1 - i)),
    sets: 0,
  }));
  for (const w of workouts.filter(finished)) {
    const main = mainItemIds(w);
    for (const l of w.logs) {
      if (!main.has(l.itemId)) continue;
      const trains = byId
        .get(l.exerciseId)
        ?.muscles.some((m) => m.role === 'primary' && family.has(m.muscleKey));
      if (!trains) continue;
      const bar = bars.find(
        (b) => b.weekStart === weekStart(localDate(new Date(l.loggedAt)), startsOn),
      );
      if (bar) bar.sets++;
    }
  }
  return bars;
}

/**
 * Primary muscles by main-work sets, most trained first. Ties follow the
 * sessions' own target order (QA round 2: lats beat the goal muscles
 * alphabetically), then the key.
 */
export function trainedMuscles(workouts: WorkoutRecord[], library: Exercise[]): string[] {
  const order = workouts
    .filter(finished)
    .flatMap((w) => w.session.items.filter((i) => i.role === 'main'))
    .flatMap((i) => (i.targetMuscle ? [i.targetMuscle] : []));
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byId = new Map(library.map((e) => [e.id, e]));
  const counts = new Map<string, number>();
  for (const w of workouts.filter(finished)) {
    const main = mainItemIds(w);
    for (const l of w.logs) {
      if (!main.has(l.itemId)) continue;
      for (const m of byId.get(l.exerciseId)?.muscles ?? []) {
        if (m.role === 'primary') counts.set(m.muscleKey, (counts.get(m.muscleKey) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -1 : 1))
    .map(([k]) => k);
}

/** Muscles offered as chart tabs: the goals first, then the most trained. */
export function chartMuscles(
  goals: string[],
  workouts: WorkoutRecord[],
  library: Exercise[],
  max = 3,
): string[] {
  return [...new Set([...goals, ...trainedMuscles(workouts, library)])].slice(0, max);
}

/** Workouts finished in the last `days` days, with their minutes and main sets. */
export function rangeTotals(workouts: WorkoutRecord[], now: Date, days: number) {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const done = workouts.filter((w) => finished(w) && Date.parse(w.endedAt ?? w.createdAt) >= since);
  return {
    workouts: done,
    minutes: done.reduce((n, w) => n + workoutMinutes(w, now), 0),
    sets: totals(done).sets,
  };
}

/** Minutes from start to end, at least 1. */
export function workoutMinutes(w: WorkoutRecord, now: Date): number {
  const end = Date.parse(w.endedAt ?? now.toISOString());
  const start = Date.parse(w.startedAt ?? w.createdAt);
  return Math.max(1, Math.round((end - start) / 60000));
}
