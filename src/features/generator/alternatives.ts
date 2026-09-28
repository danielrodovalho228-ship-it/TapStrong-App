import { ALL_EQUIPMENT } from '../equipment/catalog';
import type { Exercise, SessionPart } from '../exercises/types';
import { muscleByKey, muscleFamily } from '../muscles';
import { defaultMuscleGoal } from '../onboarding/options';

import { doseFor, estimateSeconds, needsCaution } from './dosage';
import { emphasisOn, isMachine, needsJointCare, programmablePool } from './filters';
import type {
  GeneratedSession,
  GeneratorInput,
  SessionItem,
  SwapReason,
  SwapRecord,
} from './types';

export const MAX_ALTERNATIVES = 5;
/** Below this many same-muscle options, the swap sheet looks one circle wider. */
const MIN_OPTIONS = 3;

/** Body regions of an exercise's primary muscles (upper, core, lower). */
const regionsOf = (e: Exercise | undefined) =>
  new Set(
    (e?.muscles ?? [])
      .filter((m) => m.role === 'primary')
      .map((m) => muscleByKey(m.muscleKey)?.region)
      .filter(Boolean),
  );

/** Same region, or either is whole-body cardio / breathing (no single region). */
function sameRegion(e: Exercise, current: Exercise | undefined): boolean {
  if (!current || current.pattern === 'cardio' || current.pattern === 'breathing') return true;
  const a = regionsOf(current);
  return [...regionsOf(e)].some((r) => a.has(r));
}

const MOBILITY_PARTS: SessionPart[] = ['finisher_mobility', 'cooldown_stretch', 'warmup_mobility'];
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A muscle and its group: upper chest → chest, upper, mid and lower chest. */
function groupOf(muscles: string[]): string[] {
  return [
    ...new Set(
      muscles.flatMap((m) => {
        const base = muscleByKey(m)?.parentKey ?? m;
        return [m, base, ...muscleFamily(base)];
      }),
    ),
  ];
}

function primaryFamily(item: SessionItem, current: Exercise | undefined): string[] {
  if (item.targetMuscle) return muscleFamily(item.targetMuscle);
  return (current?.muscles ?? []).filter((m) => m.role === 'primary').map((m) => m.muscleKey);
}

/**
 * Safe alternatives for one item of a session (SPEC §8 "Swap"):
 * - same primary muscle and same role in the session (warm-up and cool-down
 *   moves only swap within the same part);
 * - released only (drafts in dev builds), through every generator safety
 *   filter: location and equipment, age band, restrictions, conditions,
 *   position;
 * - never an exercise already in the session;
 * - "machine is taken" also drops options that use the same machine;
 * - the balance item swaps only for balance work.
 * Order: emphasis on the muscle, then same movement pattern, then closest
 * level, then slug. Deterministic.
 */
export function getAlternatives(
  session: GeneratedSession,
  itemId: string,
  input: GeneratorInput,
  options: { limit?: number; reason?: SwapReason } = {},
): Exercise[] {
  const limit = options.limit ?? MAX_ALTERNATIVES;
  const item = session.items.find((i) => i.id === itemId);
  if (!item || item.part === 'ramp_up') return [];
  const byId = new Map(input.library.map((e) => [e.id, e]));
  const current = byId.get(item.exerciseId);
  const family = primaryFamily(item, current);
  const inSession = new Set(session.items.map((i) => i.exerciseId));
  const busyMachines =
    options.reason === 'machine_taken' ? (current?.equipment ?? []).filter(isMachine) : [];

  const group = groupOf(family);
  const slotOk = (e: Exercise) => {
    // Warm-up and cool-down swaps stay in the same part AND body region (QA A-11).
    if (item.part === 'cooldown_stretch') return e.parts.includes('cooldown_stretch');
    if (item.role !== 'main')
      return e.parts.includes(item.part as SessionPart) && sameRegion(e, current);
    // The balance item swaps only for other balance work, any muscle (QA R3-08).
    if (item.goal === 'balance' && current?.pattern === 'balance')
      return e.pattern === 'balance' && e.parts.includes('main');
    return item.goal === 'mobility'
      ? e.parts.some((p) => MOBILITY_PARTS.includes(p))
      : e.parts.includes('main');
  };
  /**
   * How close an option is to the muscle: 0 = the same muscle as a primary,
   * 1 = its muscle group as a primary (upper chest → chest), 2 = the muscle
   * or group as a secondary. Warm-up moves and the balance item don't use it.
   * A stretch is "same muscle": its muscle or its group, never another one
   * (QA round 2: a neck stretch offered triceps).
   */
  const tier = (e: Exercise): number | null => {
    if (item.part !== 'cooldown_stretch' && item.role !== 'main') return 0;
    if (item.goal === 'balance' && current?.pattern === 'balance') return 0;
    if (emphasisOn(e, family, 'primary') > 0) return 0;
    if (emphasisOn(e, group, 'primary') > 0) return item.part === 'cooldown_stretch' ? 0 : 1;
    if (emphasisOn(e, group) > 0) return 2;
    return null;
  };

  const ranked = programmablePool(input)
    .filter((e) => !inSession.has(e.id) && slotOk(e))
    .filter((e) => !e.equipment.some((q) => busyMachines.includes(q)))
    .map((e) => ({
      e,
      tier: tier(e),
      fav: input.favourites?.includes(e.id) ? 1 : 0,
      emphasis: Math.round(emphasisOn(e, family, 'primary') * 10),
      samePattern: current && e.pattern === current.pattern ? 1 : 0,
      distance: Math.abs(e.level - (current?.level ?? e.level)),
    }))
    .filter((x): x is typeof x & { tier: number } => x.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.fav - a.fav ||
        b.emphasis - a.emphasis ||
        b.samePattern - a.samePattern ||
        a.distance - b.distance ||
        byText(a.e.slug, b.e.slug),
    );
  // Wider circles only when the same muscle leaves fewer than 3 options (QA R3 P2).
  const closest = ranked.filter((x) => x.tier === 0);
  const picks = (closest.length >= MIN_OPTIONS ? closest : ranked).map((x) => x.e);
  // A warm-up move with fewer than 3 same-region options (a seated 60+ at
  // home, QA R4 P2) also gets other warm-up moves of the same part.
  if (item.role === 'warmup' && picks.length < MIN_OPTIONS) {
    const more = programmablePool(input).filter(
      (e) =>
        !inSession.has(e.id) && !picks.includes(e) && e.parts.includes(item.part as SessionPart),
    );
    more.sort((a, b) => byText(a.slug, b.slug));
    picks.push(...more);
  }
  return picks.slice(0, limit);
}

/**
 * Close options left out only because of equipment the person doesn't have
 * (improvements v1). The swap sheet lists them as plain text — they are never
 * offered, so it still offers at most MAX_ALTERNATIVES replacements.
 */
export function missingEquipmentOptions(
  session: GeneratedSession,
  itemId: string,
  input: GeneratorInput,
  options: { reason?: SwapReason } = {},
): Exercise[] {
  const offered = new Set(getAlternatives(session, itemId, input, options).map((e) => e.id));
  const have = new Set<string>(input.equipment);
  return getAlternatives(session, itemId, { ...input, equipment: ALL_EQUIPMENT }, options).filter(
    (e) => !offered.has(e.id) && e.equipment.some((q) => !have.has(q)),
  );
}

/** Core and balance work never gets ramp-up sets, even with a dumbbell (QA R4 P2: dead bug). */
const NO_RAMP_PATTERNS = ['core_stability', 'core_flexion', 'rotation', 'balance', 'breathing'];
export const rampable = (e: Pick<Exercise, 'loaded' | 'isolation' | 'pattern'>) =>
  e.loaded && !e.isolation && !NO_RAMP_PATTERNS.includes(e.pattern);

/** The generator's ramp-up rule (SPEC §8 table, QA R2-07): same check on swap. */
export function rampAllowed(e: Exercise, input: GeneratorInput): boolean {
  return (
    rampable(e) &&
    input.mode !== 'child' &&
    !needsCaution(input.conditions) &&
    !needsJointCare(e, input)
  );
}

/**
 * Replaces one item in place — never adds an item (SPEC §8 "Swap").
 * Sets are kept; reps are recomputed from the goal for the new exercise.
 * When some sets are already logged, the swap covers only the remaining ones.
 */
export function swapItem(
  session: GeneratedSession,
  itemId: string,
  next: Exercise,
  input: GeneratorInput,
  options: { reason: SwapReason; setsDone?: number },
): { session: GeneratedSession; record: SwapRecord } {
  const index = session.items.findIndex((i) => i.id === itemId);
  if (index < 0) throw new Error(`no item ${itemId}`);
  const old = session.items[index];
  const setsDone = Math.max(0, Math.min(options.setsDone ?? 0, old.sets));

  let updated: SessionItem;
  if (old.role === 'main') {
    const dose = doseFor(
      old.goal ?? defaultMuscleGoal(input.mainGoals),
      input.mode,
      next,
      old.sets,
      {
        // Same dosing as generation (QA R3-07): a swapped-in move that loads a
        // restricted or painful joint is dosed light too.
        caution: needsCaution(input.conditions),
        rehab: input.rehab,
        jointCare: needsJointCare(next, input),
      },
    );
    const kept = { ...dose, sets: old.sets };
    updated = {
      ...old,
      exerciseId: next.id,
      reps: kept.reps,
      holdSeconds: kept.holdSeconds,
      restSeconds: kept.restSeconds,
      perSide: kept.perSide,
      loadHint: kept.loadHint,
      estSeconds: estimateSeconds(kept),
    };
  } else {
    updated = {
      ...old,
      exerciseId: next.id,
      perSide: old.part === 'cooldown_stretch' ? next.unilateral : old.perSide,
    };
    if (old.part === 'cooldown_stretch') updated.estSeconds = 30 * (next.unilateral ? 2 : 1) + 10;
  }
  if (setsDone > 0) {
    updated.replaced = [...(old.replaced ?? []), { exerciseId: old.exerciseId, setsDone }];
  }

  let items = session.items.map((i, n) => (n === index ? updated : i));

  // The ramp-up mirrors the first loaded main lift: follow the swap when the
  // new lift may have one (the generator's own check, QA R3-07), otherwise
  // drop it. Still never adds an item.
  const ramp = items.find((i) => i.part === 'ramp_up');
  if (old.role === 'main' && ramp?.exerciseId === old.exerciseId && setsDone === 0) {
    const keep = rampAllowed(next, input);
    items = items
      .map((i) =>
        i.part === 'ramp_up'
          ? keep
            ? { ...i, exerciseId: next.id, perSide: next.unilateral }
            : null
          : i,
      )
      .filter((i): i is SessionItem => i !== null);
  }

  const work = items
    .filter((i) => i.role === 'main' || i.role === 'finisher')
    .reduce((s, i) => s + i.estSeconds, 0);
  return {
    session: {
      ...session,
      items,
      estimatedMinutes: Math.round(
        ((session.warmupMinutes + session.cooldownMinutes) * 60 + work) / 60,
      ),
    },
    record: {
      itemId,
      fromExerciseId: old.exerciseId,
      toExerciseId: next.id,
      reason: options.reason,
      setsDoneBefore: setsDone,
    },
  };
}
