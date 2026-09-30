import type { WorkoutRecord } from '@/features/workout/types';
import { localDate, weekStart, type WeekStartDay } from '@/lib/dates';

/** Finished workouts (and short mobility) this week, by the day they started. */
export function workoutsThisWeekDone(
  workouts: WorkoutRecord[],
  now: Date,
  startsOn: WeekStartDay,
): number {
  const week = weekStart(localDate(now), startsOn);
  return workouts.filter(
    (w) =>
      (w.status === 'done' || w.status === 'partial') &&
      weekStart(localDate(new Date(w.startedAt ?? w.createdAt)), startsOn) === week,
  ).length;
}

/**
 * Identity, not guilt (Phase 27, B4): "You trained 3 times this week. That's
 * consistency." Nothing at all at zero: never "you missed 2 workouts".
 */
export function identityKey(count: number) {
  if (count <= 0) return null;
  if (count === 1) return 'home.identity.one' as const;
  if (count === 2) return 'home.identity.two' as const;
  return 'home.identity.many' as const;
}
