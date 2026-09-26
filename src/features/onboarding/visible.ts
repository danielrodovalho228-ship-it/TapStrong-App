import type { AppMode } from '../profile/age';

import { MAIN_GOALS, type MainGoal } from './options';

/** No weight-loss goal for minors (SPEC §2.3: no body-fat language for under 18). */
export function visibleMainGoals(mode: AppMode): MainGoal[] {
  return MAIN_GOALS.filter((g) => !(g === 'lose_weight' && (mode === 'teen' || mode === 'child')));
}
