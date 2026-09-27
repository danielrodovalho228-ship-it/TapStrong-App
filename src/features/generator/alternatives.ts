import type { Exercise, SessionPart } from '../exercises/types';
import { muscleByKey, muscleFamily } from '../muscles';
import { defaultMuscleGoal } from '../onboarding/options';

import { doseFor, estimateSeconds, needsCaution } from './dosage';
import { emphasisOn, isMachine, safePool } from './filters';
import type {
  GeneratedSession,
  GeneratorInput,
  SessionItem,
  SwapReason,
  SwapRecord,
} from './types';

export const MAX_ALTERNATIVES = 5;

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
 * - "machine is taken" also drops options that use the same machine.
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

  return safePool(input)
    .filter((e) => !inSession.has(e.id))
    .filter((e) => {
      // Warm-up and cool-down swaps stay in the same part AND body region (QA A-11).
      if (item.role !== 'main')
        return e.parts.includes(item.part as SessionPart) && sameRegion(e, current);
      const sameSlot =
        item.goal === 'mobility'
          ? e.parts.some((p) => MOBILITY_PARTS.includes(p))
          : e.parts.includes('main');
      return sameSlot && emphasisOn(e, family, 'primary') > 0;
    })
    .filter((e) => !e.equipment.some((q) => busyMachines.includes(q)))
    .map((e) => ({
      e,
      emphasis: Math.round(emphasisOn(e, family, 'primary') * 10),
      samePattern: current && e.pattern === current.pattern ? 1 : 0,
      distance: Math.abs(e.level - (current?.level ?? e.level)),
    }))
    .sort(
      (a, b) =>
        b.emphasis - a.emphasis ||
        b.samePattern - a.samePattern ||
        a.distance - b.distance ||
        byText(a.e.slug, b.e.slug),
    )
    .slice(0, limit)
    .map((x) => x.e);
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
        caution: needsCaution(input.conditions),
        rehab: input.rehab,
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

  // The ramp-up mirrors the first main exercise: follow the swap, or drop the
  // ramp-up when the new exercise has no load (still never adds an item).
  const firstMain = items.find((i) => i.role === 'main');
  if (firstMain?.id === itemId && setsDone === 0) {
    items = items
      .map((i) => (i.part === 'ramp_up' ? (next.loaded ? { ...i, exerciseId: next.id } : null) : i))
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
