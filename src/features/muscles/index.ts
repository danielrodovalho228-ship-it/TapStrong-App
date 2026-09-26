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
};

export const MUSCLES = data as Muscle[];
export const MUSCLE_KEYS = MUSCLES.map((m) => m.key);

export function muscleByKey(key: string): Muscle | undefined {
  return MUSCLES.find((m) => m.key === key);
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
