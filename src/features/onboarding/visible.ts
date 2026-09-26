import type { AppMode } from '../profile/age';

import { MAIN_GOALS, type MainGoal } from './options';

/**
 * Under 18, "lose weight" is replaced by "more fitness / energy"
 * (SPEC §2.3: no body-fat language for minors). Adults keep the original list.
 */
export function visibleMainGoals(mode: AppMode): MainGoal[] {
  const minor = mode === 'teen' || mode === 'child';
  return MAIN_GOALS.filter((g) => (minor ? g !== 'lose_weight' : g !== 'fitness')).sort(
    (a, b) => order(a) - order(b),
  );
}

// Show "fitness" where "lose weight" would be, so the list reads the same.
function order(goal: MainGoal): number {
  return goal === 'fitness' ? MAIN_GOALS.indexOf('lose_weight') : MAIN_GOALS.indexOf(goal);
}
