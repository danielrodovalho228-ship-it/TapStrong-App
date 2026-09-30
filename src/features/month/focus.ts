import { muscleByKey } from '../muscles';

import { LARGE_MUSCLES, LOW_WEEKLY_SETS } from './summary';

/**
 * Next month's focus (Daniel, Phase 26, D): at most 2 muscles, on top of the
 * person's own goals (never instead of them), in this order:
 *  1. one of the person's muscles that stayed under ~4 sets a week;
 *  2. an imbalance: push (chest + front shoulders) vs pull (back), quads vs
 *     hamstrings, or a side difference from Repair ("uneven");
 *  3. a big muscle not trained for 14+ days.
 * A focus muscle gets +2–3 sets a week (one more set per session), inside
 * the weekly limits.
 */
export const MAX_FOCUS = 2;
export const NEGLECTED_DAYS = 14;
/** One side more than 1.5× the other counts as an imbalance. */
export const IMBALANCE = 1.5;

export type FocusReason = 'lowGoal' | 'pushPull' | 'quadsHams' | 'uneven' | 'neglected';
export type FocusPick = { muscle: string; reason: FocusReason };

const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;

export function suggestFocus(input: {
  /** Average working sets a week per parent muscle over the block. */
  weekly: Record<string, number>;
  /** The person's own muscle goals. */
  goals: string[];
  /** Days since each parent muscle was last trained (missing = never). */
  daysSince: Record<string, number>;
  /** Muscles a Repair test found uneven (left vs right). */
  uneven?: string[];
}): FocusPick[] {
  const picks: FocusPick[] = [];
  const add = (muscle: string, reason: FocusReason) => {
    const m = parentOf(muscle);
    if (picks.length < MAX_FOCUS && !picks.some((p) => p.muscle === m))
      picks.push({ muscle: m, reason });
  };
  const w = (m: string) => input.weekly[m] ?? 0;

  // 1. The person's muscles under the minimum, least trained first.
  [...new Set(input.goals.map(parentOf))]
    .filter((m) => w(m) < LOW_WEEKLY_SETS)
    .sort((a, b) => w(a) - w(b) || (a < b ? -1 : 1))
    .forEach((m) => add(m, 'lowGoal'));

  // 2. Imbalances.
  const push = w('chest') + w('shoulders');
  const pull = w('upperBack') + w('lats');
  if (push > IMBALANCE * pull && push > 0)
    add(w('upperBack') <= w('lats') ? 'upperBack' : 'lats', 'pushPull');
  else if (pull > IMBALANCE * push && pull > 0) add('chest', 'pushPull');
  const quads = w('quads');
  const hams = w('hamstrings');
  if (quads > IMBALANCE * hams && quads > 0) add('hamstrings', 'quadsHams');
  else if (hams > IMBALANCE * quads && hams > 0) add('quads', 'quadsHams');
  for (const m of input.uneven ?? []) add(m, 'uneven');

  // 3. Big muscles left alone for two weeks or more.
  LARGE_MUSCLES.filter((m) => (input.daysSince[m] ?? Number.POSITIVE_INFINITY) >= NEGLECTED_DAYS)
    .sort((a, b) => w(a) - w(b) || (a < b ? -1 : 1))
    .forEach((m) => add(m, 'neglected'));

  return picks;
}
