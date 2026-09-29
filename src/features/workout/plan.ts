import { localDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import type { GeneratedSession, GeneratorInput, RecentSession } from '../generator/types';
import { muscleByKey, type MovementGroup } from '../muscles';
import { JOINT_AREA } from '../movement/catalog';
import { generateSession, needsRecovery } from '../generator/generate';
import { defaultMuscleGoal } from '../onboarding/options';

import { groupMuscles } from './recovery';
import type { NextFocus, WorkoutRecord } from './types';

/** Finished workouts as balance-pass input, most recent first (SPEC §8). */
export function recentSessions(history: WorkoutRecord[], library: Exercise[]): RecentSession[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;
  return (
    history
      // Finishers and Repair sessions count too, for recovery and the weekly
      // cap (Daniel, QA R9 decision 2); short mobility sessions have no sets.
      .filter(
        (w) =>
          (w.status === 'done' || w.status === 'partial') &&
          (w.kind === 'regular' || w.kind === 'finisher' || w.kind === 'repair'),
      )
      .sort((a, b) => ((a.endedAt ?? '') < (b.endedAt ?? '') ? 1 : -1))
      .map((w) => {
        const main = new Set(
          w.session.items
            .filter((i) => i.role === 'main' || i.role === 'finisher')
            .map((i) => i.id),
        );
        // Balance and mobility moves don't need recovery (QA R3-08).
        const working = w.logs.filter(
          (l) => main.has(l.itemId) && needsRecovery(byId.get(l.exerciseId)),
        );
        const primaries = (id: string) =>
          (byId.get(id)?.muscles ?? []).filter((m) => m.role === 'primary').map((m) => m.muscleKey);
        const tally = (keys: (id: string) => string[]) =>
          working.reduce<Record<string, number>>((acc, l) => {
            for (const k of keys(l.exerciseId)) acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {});
        return {
          date: localDate(new Date(w.endedAt ?? w.createdAt)),
          // Recovery counts from the start of the session (QA R3-04).
          at: w.startedAt ?? w.endedAt ?? w.createdAt,
          mainMuscles: [...new Set(working.flatMap((l) => primaries(l.exerciseId)))],
          ...(w.session.custom ? { custom: true } : {}),
          ...(w.kind === 'finisher' || w.kind === 'repair' ? { kind: w.kind } : {}),
          exerciseIds: [
            ...new Set(w.logs.filter((l) => main.has(l.itemId)).map((l) => l.exerciseId)),
          ],
          // Each logged set counts once per parent muscle: a plank's upper
          // and lower abs are one abs set, not two (QA R9-06).
          muscleSets: tally((id) => [...new Set(primaries(id).map(parentOf))]),
          // And once per joint area it loads, for the joint-care budget.
          // Repair sets are therapeutic: they don't use the painful-joint
          // budget (Daniel, R10 decision 2).
          jointSets:
            w.kind === 'repair'
              ? {}
              : tally((id) => [
                  ...new Set((byId.get(id)?.joints ?? []).map((j) => JOINT_AREA[j.joint])),
                ]),
        };
      })
  );
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
    // A Repair session keeps its prescribed moves at the weekly cap (Daniel,
    // R9 decision 2; QA R10-02: the real path never set it).
    repair: true,
    muscleGoals: focus.map(({ muscleKey, goal }) => ({ muscleKey, goal })),
    // Corrective work: no cardio finisher.
    mainGoals: input.mainGoals.filter((g) => g !== 'lose_weight' && g !== 'fitness'),
  };
}

/** Muscles a session's main work is built for, in order (for the Home card, QA D-01). */
export function sessionTargets(session: GeneratedSession, max = 2): string[] {
  return [
    ...new Set(
      session.items
        .filter((i) => i.role === 'main' && i.targetMuscle)
        .map((i) => i.targetMuscle as string),
    ),
  ].slice(0, max);
}

/** The session "Start" would build right now, without storing it. */
export function previewSession(
  input: GeneratorInput | null,
  library: Exercise[],
  nextFocus: NextFocus,
): GeneratedSession | null {
  const s = todaySession(input, library, nextFocus);
  return s && !s.error ? s : null;
}

/** Same, errors included: Home shows the all-recovering day honestly (QA R3-03). */
export function todaySession(
  input: GeneratorInput | null,
  library: Exercise[],
  nextFocus: NextFocus,
): GeneratedSession | null {
  if (!input) return null;
  return generateSession(withFocus(input, nextFocus, library));
}
