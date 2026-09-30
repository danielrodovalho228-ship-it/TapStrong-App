import type { AppMode } from '../profile/age';

/**
 * Next month's exercises (Daniel, Phase 26, C): systematic variation between
 * blocks, not random changes every workout.
 *  - Keep the main compound move that is still progressing: it measures the
 *    evolution.
 *  - Swap at least half of the accessories for safe options for the same
 *    muscle, preferring what wasn't done in the last 2 blocks and another
 *    angle.
 *  - Swap anything stalled for 3 weeks, or that hurt during the block; a
 *    move that gave a sharp pain never comes back.
 *  - Never swap starred or locked moves (a sharp pain still takes it out).
 *  - At most ~50% of the moves change (adults, teens); 60+ and joint care
 *    at most 2 a month.
 * Weekly set limits, the joint budget, equipment and restrictions stay with
 * the generator: this only says what to prefer and what to leave out.
 */
export type Progress = 'up' | 'flat' | 'unknown';
export type SwapReason = 'pain' | 'stalled' | 'variety';

export type RenewItem = {
  exerciseId: string;
  /** Parent muscle it was programmed for. */
  muscle: string;
  compound: boolean;
  progress: Progress;
  pain: 'sharp' | 'dull' | null;
  jointCare: boolean;
};

export type Change = { from: string; to: string | null; reason: SwapReason; muscle: string };

export type RenewResult = {
  keep: string[];
  changes: Change[];
  /** This month's moves, preferred by the generator. */
  next: string[];
  /** Swapped out: left out this month unless starred. */
  avoid: string[];
  /** Sharp pain: never again. */
  banned: string[];
};

/** How many moves may change this month. */
export function changeLimit(mode: AppMode, items: Pick<RenewItem, 'jointCare'>[]): number {
  if (mode === 'senior' || items.some((i) => i.jointCare)) return 2;
  return Math.max(1, Math.floor(items.length / 2));
}

export function planRenewal(input: {
  items: RenewItem[];
  favourites: readonly string[];
  locked: readonly string[];
  /** Moves done in the last 2 blocks: replacements avoid them when they can. */
  recent: readonly string[];
  mode: AppMode;
  /** Safe options for the same muscle, best first (another angle first). */
  candidates: (item: RenewItem, exclude: ReadonlySet<string>) => string[];
}): RenewResult {
  const items = input.items.filter(
    (it, i, all) => all.findIndex((x) => x.exerciseId === it.exerciseId) === i,
  );
  const held = (it: RenewItem) =>
    input.favourites.includes(it.exerciseId) || input.locked.includes(it.exerciseId);
  const limit = changeLimit(input.mode, items);
  const changes: Change[] = [];
  const taken = new Set(items.map((i) => i.exerciseId));
  const changed = new Set<string>();

  const replace = (it: RenewItem, reason: SwapReason, force = false) => {
    if (changed.has(it.exerciseId)) return;
    if (!force && changes.length >= limit) return;
    const options = input.candidates(it, taken);
    const to = options.find((id) => !input.recent.includes(id)) ?? options[0] ?? null;
    // Nothing safe to swap in: a painful move still goes, the rest stays.
    if (!to && reason !== 'pain') return;
    if (to) taken.add(to);
    changed.add(it.exerciseId);
    changes.push({ from: it.exerciseId, to, reason, muscle: it.muscle });
  };

  // 1. Safety first: a sharp pain always goes, starred or not, over the limit.
  items.filter((it) => it.pain === 'sharp').forEach((it) => replace(it, 'pain', true));
  // 2. Other pain, then stalled moves.
  items.filter((it) => it.pain === 'dull' && !held(it)).forEach((it) => replace(it, 'pain'));
  items.filter((it) => it.progress === 'flat' && !held(it)).forEach((it) => replace(it, 'stalled'));
  // 3. Variety: at least half the accessories of each muscle. The main
  //    compound that is progressing (or not measured yet) stays.
  const muscles = [...new Set(items.map((i) => i.muscle))];
  for (const m of muscles) {
    const accessories = items
      .filter((it) => it.muscle === m && !it.compound && !held(it))
      .sort((a, b) => Number(a.progress === 'up') - Number(b.progress === 'up'));
    const need = Math.ceil(accessories.length / 2);
    const done = () => accessories.filter((a) => changed.has(a.exerciseId)).length;
    for (const a of accessories) {
      if (done() >= need) break;
      replace(a, 'variety');
    }
  }

  const keep = items.map((i) => i.exerciseId).filter((id) => !changed.has(id));
  const added = changes.map((c) => c.to).filter((id): id is string => !!id);
  return {
    keep,
    changes,
    next: [...keep, ...added],
    avoid: changes.map((c) => c.from),
    banned: items.filter((it) => it.pain === 'sharp').map((it) => it.exerciseId),
  };
}

/**
 * "Repeat the same": this block's moves exactly, to measure progress on the
 * same movements. A move that gave a sharp pain still never comes back.
 */
export function repeatPlan(items: RenewItem[]): RenewResult {
  const banned = items.filter((it) => it.pain === 'sharp').map((it) => it.exerciseId);
  const keep = [...new Set(items.map((i) => i.exerciseId))].filter((id) => !banned.includes(id));
  return { keep, changes: [], next: keep, avoid: [], banned };
}
