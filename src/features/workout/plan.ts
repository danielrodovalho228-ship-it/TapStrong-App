import { localDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import type { GeneratedSession, GeneratorInput, RecentSession } from '../generator/types';
import type { MovementGroup } from '../muscles';
import { defaultMuscleGoal } from '../onboarding/options';

import { groupMuscles } from './recovery';
import type { WorkoutRecord } from './types';

/** Finished workouts as balance-pass input, most recent first (SPEC §8). */
export function recentSessions(history: WorkoutRecord[], library: Exercise[]): RecentSession[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  return history
    .filter((w) => (w.status === 'done' || w.status === 'partial') && w.kind === 'regular')
    .sort((a, b) => ((a.endedAt ?? '') < (b.endedAt ?? '') ? 1 : -1))
    .map((w) => {
      const main = new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));
      const muscles = w.logs
        .filter((l) => main.has(l.itemId))
        .flatMap((l) =>
          (byId.get(l.exerciseId)?.muscles ?? [])
            .filter((m) => m.role === 'primary')
            .map((m) => m.muscleKey),
        );
      return {
        date: localDate(new Date(w.endedAt ?? w.createdAt)),
        mainMuscles: [...new Set(muscles)],
      };
    });
}

/** Group muscles, the ones most of the library trains first. */
function focusMuscles(group: MovementGroup, library: Exercise[], count: number): string[] {
  const hits = (key: string) =>
    library.filter(
      (e) =>
        e.parts.includes('main') &&
        e.muscles.some((m) => m.muscleKey === key && m.role === 'primary'),
    ).length;
  return groupMuscles(group, library)
    .sort((a, b) => hits(b) - hits(a) || (a < b ? -1 : 1))
    .slice(0, count);
}

/** "Legs next time": the group's muscles go first, once (mockup 14). */
export function withFocus(
  input: GeneratorInput,
  group: MovementGroup | null,
  library: Exercise[],
): GeneratorInput {
  if (!group) return input;
  const goal = defaultMuscleGoal(input.mainGoals);
  const first = focusMuscles(group, library, 2)
    .filter((k) => !input.muscleGoals.some((g) => g.muscleKey === k))
    .map((muscleKey) => ({ muscleKey, goal }));
  return { ...input, muscleGoals: [...first, ...input.muscleGoals] };
}

export const FINISHER_MINUTES = 10;

/** "Add 10 min": a short session for the neglected group, warm-up included. */
export function finisherInput(
  input: GeneratorInput,
  group: MovementGroup,
  library: Exercise[],
): GeneratorInput {
  const goal = defaultMuscleGoal(input.mainGoals);
  return {
    ...input,
    minutes: FINISHER_MINUTES,
    exercisesPerSession: 2,
    muscleGoals: focusMuscles(group, library, 2).map((muscleKey) => ({ muscleKey, goal })),
    // The finisher itself is the extra work; no cardio or mobility add-on.
    mainGoals: input.mainGoals.filter((g) => g !== 'lose_weight' && g !== 'fitness'),
  };
}

/** True when every exercise has passed certified review (the coach badge). */
export function isReviewed(session: GeneratedSession, library: Exercise[]): boolean {
  const byId = new Map(library.map((e) => [e.id, e]));
  return session.items.every((i) => byId.get(i.exerciseId)?.status === 'released');
}

/** A Repair session (Phase 7): 15 minutes on the plan's focus muscles. */
export function repairInput(
  input: GeneratorInput,
  focus: { muscleKey: string; goal: 'strengthen' | 'balance' | 'mobility' }[],
  minutes = 15,
): GeneratorInput {
  return {
    ...input,
    minutes,
    exercisesPerSession: 3,
    muscleGoals: focus.map(({ muscleKey, goal }) => ({ muscleKey, goal })),
    // Corrective work: no cardio finisher.
    mainGoals: input.mainGoals.filter((g) => g !== 'lose_weight' && g !== 'fitness'),
  };
}
