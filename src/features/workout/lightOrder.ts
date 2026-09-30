import type { Exercise } from '@/features/exercises/types';
import { muscleByKey } from '@/features/muscles';

import type { WorkoutRecord } from './types';

/**
 * The muscles a finished workout worked, in the order they light up on the
 * map (Phase 27, B1): the session's targets first, then every other primary
 * muscle in the order they were trained, then the secondary ones. Only
 * muscles drawn on the body count; each appears once.
 */
export function lightOrder(workout: WorkoutRecord, library: Exercise[]): string[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const logged = new Set(workout.logs.map((l) => `${l.itemId}|${l.exerciseId}`));
  const items = workout.session.items.filter((i) =>
    [...logged].some((k) => k.startsWith(`${i.id}|`)),
  );
  const targets = items
    .filter((i) => i.role === 'main' && i.targetMuscle)
    .map((i) => i.targetMuscle as string);
  const exercises = workout.logs
    .map((l) => byId.get(l.exerciseId))
    .filter((e): e is Exercise => !!e);
  const primary = exercises.flatMap((e) =>
    e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey),
  );
  const secondary = exercises.flatMap((e) =>
    e.muscles.filter((m) => m.role !== 'primary').map((m) => m.muscleKey),
  );
  return [...new Set([...targets, ...primary, ...secondary])].filter(
    (k) => (muscleByKey(k)?.views.length ?? 0) > 0,
  );
}
