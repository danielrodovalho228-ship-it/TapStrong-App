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

export type DoseOptions = {
  /** Heart condition or high blood pressure: moderate reps, no heavy sets (QA C-09). */
  caution?: boolean;
  /** A Repair recovery session: gentle holds and light reps (QA A-03). */
  rehab?: boolean;
  /**
   * The move loads a restricted or painful joint: light, 12–15, no heavy
   * sets (QA R2-07; reviewer to confirm).
   */
  jointCare?: boolean;
};

/** Multi-joint patterns: the only ones dosed as heavy strength (QA round 2). */
const COMPOUND_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
];

/** Heart condition or high blood pressure call for moderate effort. */
export const needsCaution = (conditions: readonly string[]) =>
  conditions.includes('heart_condition') || conditions.includes('high_blood_pressure');

/**
 * Dosage by goal — SPEC §8 table. The user's "sets each" is honored as set
 * (1–5; up to 3 for kids, teens and 60+; QA D-02). Timed exercises (planks,
 * holds) get seconds, not reps. Balance exercises are always holds.
 */
export function doseFor(
  goal: MuscleGoal,
  mode: AppMode,
  exercise: Exercise,
  requestedSets: number,
  options: DoseOptions = {},
): Dose {
  const minor = mode === 'child' || mode === 'teen';
  const perSide = exercise.unilateral;
  const timed = exercise.dose === 'time';
  const bodyweight = exercise.equipment.length === 0;
  const sets = clamp(requestedSets, 1, minor || mode === 'senior' ? 3 : 5);
  // Load words only for loaded moves: bodyweight, or light for bands (QA A-05).
  // Minors always use a light load, with the focus on technique (SPEC §2.3).
  const weighted = (hint: LoadHint): LoadHint =>
    !exercise.loaded ? (bodyweight ? 'bodyweight' : 'light') : minor ? 'light' : hint;

  // Balance and fall-prevention work is held, 20–40 s (QA B-08).
  if (exercise.pattern === 'balance') {
    return {
      sets: clamp(sets, 2, 3),
      ...(timed ? { holdSeconds: [20, 40] } : { reps: [6, 10] }),
      restSeconds: 30,
      perSide: exercise.unilateral,
      loadHint: 'bodyweight',
    };
  }
  if (options.rehab || options.jointCare) {
    return {
      sets: clamp(sets, options.rehab ? 2 : 1, 3),
      ...(timed ? { holdSeconds: [20, 30] } : { reps: [12, 15] }),
      restSeconds: options.rehab ? 45 : 60,
      perSide,
      loadHint: weighted('light'),
    };
  }
  if (options.caution && !minor) {
    return {
      sets: clamp(sets, 1, 3),
      ...(timed ? { holdSeconds: [20, 30] } : { reps: [10, 15] }),
      restSeconds: 90,
      perSide,
      loadHint: weighted('moderate'),
    };
  }

  // Isolation moves (flys, face pulls, pullovers) are never dosed heavy:
  // 10–15 with moderate rest, whatever the pattern tag (QA round 3).
  if (exercise.isolation && (goal === 'grow' || goal === 'strengthen')) {
    return {
      sets,
      ...(timed ? { holdSeconds: [20, 30] } : { reps: [10, 15] }),
      restSeconds: 60,
      perSide,
      loadHint: weighted(minor ? 'light' : 'moderate'),
    };
  }

  switch (goal) {
    case 'grow':
      return {
        sets,
        ...(timed ? { holdSeconds: [30, 45] } : { reps: [8, 12] }),
        restSeconds: mode === 'senior' || !exercise.loaded ? 60 : 75,
        perSide,
        loadHint: weighted('moderate'),
      };
    case 'firm':
      return {
        sets,
        ...(timed ? { holdSeconds: [30, 45] } : { reps: [12, 15] }),
        restSeconds: 45,
        perSide,
        loadHint: weighted('moderate'),
      };
    case 'strengthen':
      // Heavy 4–8 only for loaded multi-joint lifts; isolation, unloaded, 60+
      // and minors get 8–12 with moderate rest (QA round 2).
      return minor ||
        mode === 'senior' ||
        !exercise.loaded ||
        !COMPOUND_PATTERNS.includes(exercise.pattern)
        ? {
            sets,
            ...(timed ? { holdSeconds: [20, 30] } : { reps: [8, 12] }),
            restSeconds: minor ? 90 : 75,
            perSide,
            loadHint: weighted(minor ? 'light' : 'moderate'),
          }
        : {
            sets,
            ...(timed ? { holdSeconds: [20, 40] } : { reps: [4, 8] }),
            restSeconds: 120,
            perSide,
            loadHint: weighted('heavy'),
          };
    case 'balance':
      return {
        sets,
        ...(timed ? { holdSeconds: [20, 40] } : { reps: [8, 12] }),
        restSeconds: 30,
        // "each side" only for one-sided moves (QA P2).
        perSide,
        loadHint: weighted('light'),
      };
    case 'mobility':
      return {
        sets: clamp(sets, 1, 3),
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
