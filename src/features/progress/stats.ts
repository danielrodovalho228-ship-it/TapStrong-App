import { addDays, localDate, weekStart, type WeekStartDay } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import { muscleFamily } from '../muscles';
import type { WorkoutRecord } from '../workout/types';

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';

const mainItemIds = (w: WorkoutRecord) =>
  new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));

/** Totals for the Progress header (mockup 18). */
export function totals(workouts: WorkoutRecord[]) {
  const done = workouts.filter((w) => finished(w) && w.logs.length > 0);
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

/** Muscles offered as chart tabs: the goals first, then the most trained. */
export function chartMuscles(
  goals: string[],
  workouts: WorkoutRecord[],
  library: Exercise[],
  max = 3,
): string[] {
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
  const trained = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k]) => k);
  return [...new Set([...goals, ...trained])].slice(0, max);
}
