import data from './muscles.json';

/**
 * Bundled snapshot of the `muscles` table seed, so onboarding works offline.
 * The database is the source of truth: a test checks this file matches the
 * migration seed exactly. Never add muscles here by hand.
 */
export type Muscle = {
  key: string;
  region: 'upper' | 'core' | 'lower';
  views: ('front' | 'back')[];
  labelKey: string;
  parentKey: string | null;
  /** push / pull / legs / core, for the weekly balance pass (SPEC §8). */
  movementGroup: MovementGroup;
};

export type MovementGroup = 'push' | 'pull' | 'legs' | 'core';

export const MUSCLES = data as Muscle[];
export const MUSCLE_KEYS = MUSCLES.map((m) => m.key);

export function muscleByKey(key: string): Muscle | undefined {
  return MUSCLES.find((m) => m.key === key);
}

/** A muscle and its parts: "chest" → upper, mid and lower chest. */
export function muscleFamily(key: string): string[] {
  const children = MUSCLES.filter((m) => m.parentKey === key).map((m) => m.key);
  return children.length ? children : [key];
}

/** Muscles offered as quick-reply chips in the interview focus step. */
export const FOCUS_CHIP_KEYS = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'upperBack',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;

/** Same muscle or same group: upper chest and chest, or two chest regions (QA R3). */
export function sameMuscleGroup(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  const parent = (k: string) => muscleByKey(k)?.parentKey ?? k;
  return parent(a) === parent(b);
}
