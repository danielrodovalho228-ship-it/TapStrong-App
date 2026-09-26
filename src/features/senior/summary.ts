import type { WorkoutRecord } from '../workout/types';

export type LastWorkout = { endedAt: string; exercises: number; minutes: number };

/** The most recent finished workout, for the 60+ home card (mockup 23). */
export function lastWorkout(workouts: WorkoutRecord[]): LastWorkout | null {
  const done = workouts
    .filter((w) => (w.status === 'done' || w.status === 'partial') && w.logs.length > 0)
    .sort((a, b) => ((a.endedAt ?? a.createdAt) < (b.endedAt ?? b.createdAt) ? 1 : -1))[0];
  if (!done) return null;
  const endedAt = done.endedAt ?? done.createdAt;
  const main = new Set(done.session.items.filter((i) => i.role === 'main').map((i) => i.id));
  const exercises = new Set(done.logs.filter((l) => main.has(l.itemId)).map((l) => l.itemId)).size;
  const minutes = Math.max(
    1,
    Math.round((Date.parse(endedAt) - Date.parse(done.startedAt ?? done.createdAt)) / 60000),
  );
  return { endedAt, exercises, minutes };
}

/** Part of the day for the greeting, from the local hour. */
export const dayPart = (now: Date): 'morning' | 'afternoon' | 'evening' => {
  const h = now.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};
