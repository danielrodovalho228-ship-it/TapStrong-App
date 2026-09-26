import type { Exercise } from '../exercises/types';
import type { MuscleGoal } from '../onboarding/options';
import type { AppMode } from '../profile/age';

import type { LoadHint } from './types';

export type Dose = {
  sets: number;
  reps?: [number, number];
  holdSeconds?: [number, number];
  restSeconds: number;
  perSide: boolean;
  loadHint: LoadHint;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Dosage by goal — SPEC §8 table. The user's "sets each" is honored inside
 * the goal's range. Timed exercises (planks, holds) get seconds, not reps.
 */
export function doseFor(
  goal: MuscleGoal,
  mode: AppMode,
  exercise: Exercise,
  requestedSets: number,
): Dose {
  const minor = mode === 'child' || mode === 'teen';
  const perSide = exercise.unilateral;
  const timed = exercise.dose === 'time';
  const bodyweight = exercise.equipment.length === 0;
  // Minors always use a light load, with the focus on technique (SPEC §2.3).
  const weighted = (hint: LoadHint): LoadHint =>
    bodyweight ? 'bodyweight' : minor ? 'light' : hint;

  switch (goal) {
    case 'grow':
      return {
        sets: clamp(requestedSets, 3, 4),
        ...(timed ? { holdSeconds: [30, 45] } : { reps: [8, 12] }),
        restSeconds: 75,
        perSide,
        loadHint: weighted('moderate'),
      };
    case 'firm':
      return {
        sets: clamp(requestedSets, 2, 3),
        ...(timed ? { holdSeconds: [30, 45] } : { reps: [12, 15] }),
        restSeconds: 45,
        perSide,
        loadHint: weighted('moderate'),
      };
    case 'strengthen':
      return minor
        ? {
            sets: clamp(requestedSets, 2, 3),
            ...(timed ? { holdSeconds: [20, 30] } : { reps: [8, 12] }),
            restSeconds: 90,
            perSide,
            loadHint: weighted('light'),
          }
        : {
            sets: clamp(requestedSets, 3, 5),
            ...(timed ? { holdSeconds: [20, 40] } : { reps: [4, 8] }),
            restSeconds: 120,
            perSide,
            loadHint: weighted('heavy'),
          };
    case 'balance':
      return {
        sets: clamp(requestedSets, 2, 3),
        ...(timed ? { holdSeconds: [20, 40] } : { reps: [8, 12] }),
        restSeconds: 30,
        perSide: true,
        loadHint: weighted('light'),
      };
    case 'mobility':
      return {
        sets: 2,
        holdSeconds: [30, 45],
        restSeconds: 20,
        perSide,
        loadHint: bodyweight ? 'bodyweight' : 'light',
      };
  }
}

const SECONDS_PER_REP = 3;
const SETUP_SECONDS = 30;

/** Estimated seconds for a dosed item: work + rest between sets + setup. */
export function estimateSeconds(d: Dose): number {
  const sides = d.perSide ? 2 : 1;
  const work = d.reps
    ? ((d.reps[0] + d.reps[1]) / 2) * SECONDS_PER_REP * sides
    : (((d.holdSeconds?.[0] ?? 30) + (d.holdSeconds?.[1] ?? 30)) / 2) * sides;
  return Math.round(d.sets * work + (d.sets - 1) * d.restSeconds + SETUP_SECONDS);
}
