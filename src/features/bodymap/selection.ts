import { MUSCLES } from '../muscles';
import type { AppMode, BodyBand } from '../profile/age';

import type { MuscleGoal, MuscleGoalEntry } from '../onboarding/options';

/**
 * Parent muscles (chest, abs) have no dot of their own. When a goal was set on
 * a parent during the interview, it applies to each of its parts on the map.
 */
export function expandToHotspots(entries: MuscleGoalEntry[]): MuscleGoalEntry[] {
  const out: MuscleGoalEntry[] = [];
  for (const entry of entries) {
    const children = MUSCLES.filter((m) => m.parentKey === entry.muscleKey);
    const keys = children.length ? children.map((m) => m.key) : [entry.muscleKey];
    for (const key of keys) {
      if (!out.some((e) => e.muscleKey === key)) out.push({ muscleKey: key, goal: entry.goal });
    }
  }
  return out;
}

export function toggleMuscle(
  entries: MuscleGoalEntry[],
  muscleKey: string,
  defaultGoal: MuscleGoal,
): MuscleGoalEntry[] {
  return entries.some((e) => e.muscleKey === muscleKey)
    ? entries.filter((e) => e.muscleKey !== muscleKey)
    : [...entries, { muscleKey, goal: defaultGoal }];
}

export function setGoal(
  entries: MuscleGoalEntry[],
  muscleKey: string,
  goal: MuscleGoal,
): MuscleGoalEntry[] {
  return entries.map((e) => (e.muscleKey === muscleKey ? { ...e, goal } : e));
}

/** Priority 1 = first picked, capped at 5 (muscle_goals.priority). */
export function priorityOf(entries: MuscleGoalEntry[], muscleKey: string): number {
  const i = entries.findIndex((e) => e.muscleKey === muscleKey);
  return i < 0 ? 0 : Math.min(i + 1, 5);
}

export const BAND_OPTIONS: BodyBand[] = ['kid', 'teen', 'young', 'adult', 'mid', 'senior', 'elder'];
const ADULT_BANDS: BodyBand[] = ['young', 'adult', 'mid', 'senior', 'elder'];

/**
 * Age models a profile may show (Daniel, Sep 27 2026): adult profiles see 18+
 * bodies only; kid and teen bodies appear only on kid or teen profiles
 * (including a guardian managing one). Safety mode still comes from the
 * birth date, never from the chosen image.
 */
export function allowedBands(mode: AppMode): BodyBand[] {
  return mode === 'child' || mode === 'teen' ? BAND_OPTIONS : ADULT_BANDS;
}

/** The stored model band if still allowed for this profile, else its own band. */
export function displayBand(stored: BodyBand | undefined, own: BodyBand, mode: AppMode): BodyBand {
  return stored && allowedBands(mode).includes(stored) ? stored : own;
}

export const QUANTITY_RANGES = {
  exercises: [2, 10],
  sets: [1, 6],
  days: [1, 7],
} as const;

export function clampQuantity(kind: keyof typeof QUANTITY_RANGES, value: number): number {
  const [min, max] = QUANTITY_RANGES[kind];
  return Math.max(min, Math.min(max, value));
}

/** "Firm & tone" says "fat-loss finisher" to adults only (SPEC §2.3). */
export function firmDescriptionKey(mode: AppMode) {
  return mode === 'adult' || mode === 'senior'
    ? ('goalsSheet.goals.firm.descAdult' as const)
    : ('goalsSheet.goals.firm.descMinor' as const);
}
