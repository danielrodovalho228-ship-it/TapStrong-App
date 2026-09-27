import type { AppMode } from '../profile/age';

import { MAIN_GOALS, MUSCLE_GOALS, type MainGoal, type MuscleGoal } from './options';

/**
 * Under 18, "lose weight" is replaced by "more fitness / energy"
 * (SPEC §2.3: no body-fat language for minors). Kids under 13 get no
 * appearance goal ("Look better"; QA round 1). Adults keep the original list.
 */
export function visibleMainGoals(mode: AppMode): MainGoal[] {
  const minor = mode === 'teen' || mode === 'child';
  return MAIN_GOALS.filter(
    (g) => (minor ? g !== 'lose_weight' : g !== 'fitness') && !(mode === 'child' && g === 'look'),
  ).sort((a, b) => order(a) - order(b));
}

/** Kids under 13 train to get stronger, balance and move well: no grow / firm (QA round 1). */
export function visibleMuscleGoals(mode: AppMode): MuscleGoal[] {
  return MUSCLE_GOALS.filter((g) => !(mode === 'child' && (g === 'grow' || g === 'firm')));
}

/** A goal shown and used for this profile: a hidden one becomes "strengthen". */
export function goalForMode(goal: MuscleGoal, mode: AppMode): MuscleGoal {
  return visibleMuscleGoals(mode).includes(goal) ? goal : 'strengthen';
}

/** Words for the body choice: "Boy / Girl" under 18, "Man / Woman" for adults. */
export function sexLabelKey(sex: 'm' | 'f' | null | undefined, mode: AppMode) {
  const minor = mode === 'teen' || mode === 'child';
  if (!sex) return 'sex.neutral' as const;
  return minor ? (`sexMinor.${sex}` as const) : (`sex.${sex}` as const);
}

// Show "fitness" where "lose weight" would be, so the list reads the same.
function order(goal: MainGoal): number {
  return goal === 'fitness' ? MAIN_GOALS.indexOf('lose_weight') : MAIN_GOALS.indexOf(goal);
}
