import type { SessionItem } from '../generator/types';

import type { WorkoutRecord } from './types';

/** One thing the player asks the user to do: a set, or a timed step. */
export type Step = { item: SessionItem; index: number; setNo: number };

export type StepKind = 'timed' | 'hold' | 'reps';

export function stepKind(item: SessionItem): StepKind {
  if (item.durationSeconds) return 'timed';
  if (item.holdSeconds) return 'hold';
  return 'reps';
}

/** Every step in order: warm-up → main work → finisher → cool-down (SPEC §8). */
export function allSteps(items: SessionItem[]): Step[] {
  return items.flatMap((item, index) =>
    Array.from({ length: stepKind(item) === 'timed' ? 1 : item.sets }, (_, n) => ({
      item,
      index,
      setNo: n + 1,
    })),
  );
}

const isLogged = (w: WorkoutRecord, s: Step) =>
  w.logs.some((l) => l.itemId === s.item.id && l.setNo === s.setNo);

/**
 * The next step to do: the first one not logged and not skipped. An exercise
 * picked from "Exercises" in the player comes first while it has sets left
 * (Phase 31, D).
 */
export function currentStep(w: WorkoutRecord): Step | null {
  const open = allSteps(w.session.items).filter(
    (s) => !w.skipped.includes(s.item.id) && !isLogged(w, s),
  );
  return (w.focus ? open.find((s) => s.item.id === w.focus) : undefined) ?? open[0] ?? null;
}

/** The step after the given one that still needs doing. */
export function stepAfter(w: WorkoutRecord, step: Step): Step | null {
  const steps = allSteps(w.session.items);
  const at = steps.findIndex((s) => s.item.id === step.item.id && s.setNo === step.setNo);
  return steps.slice(at + 1).find((s) => !w.skipped.includes(s.item.id) && !isLogged(w, s)) ?? null;
}

export function setsLogged(w: WorkoutRecord, itemId: string): number {
  return w.logs.filter((l) => l.itemId === itemId).length;
}

/** Main-work sets done and planned — "You've done 2 of 12 sets" (mockup 13). */
export function mainSetCounts(w: WorkoutRecord): { done: number; total: number } {
  const main = w.session.items.filter((i) => i.role === 'main');
  return {
    done: w.logs.filter((l) => main.some((i) => i.id === l.itemId)).length,
    total: main.reduce((s, i) => s + i.sets, 0),
  };
}

/** Main exercises in order, for the player's "1 / 5" progress. */
export function mainItems(w: WorkoutRecord): SessionItem[] {
  return w.session.items.filter((i) => i.role === 'main');
}

/**
 * The warm-up can be shortened but not skipped on days with loaded work
 * (SPEC §8): a timed warm-up step can end early once half of it is done.
 */
export function canEndTimedStep(
  item: SessionItem,
  elapsedSeconds: number,
  dayHasLoad: boolean,
): boolean {
  if (item.role !== 'warmup' || !dayHasLoad) return true;
  return elapsedSeconds >= (item.durationSeconds ?? 0) / 2;
}

export function hasCooldownLeft(w: WorkoutRecord): boolean {
  const step = currentStep(w);
  return step?.item.role === 'cooldown';
}

/**
 * A cool-down stretch hold runs as a countdown too, so the workout ends
 * without a tap (Phase 27, A1): the prescribed hold (its lower bound), both
 * sides for a one-sided stretch. Null for anything else.
 */
export function cooldownHold(item: SessionItem): number | null {
  // Program holds (Phase 30) count down too, one side per set.
  if (item.countdown && item.holdSeconds) return item.holdSeconds[0];
  if (item.role !== 'cooldown' || stepKind(item) !== 'hold' || !item.holdSeconds) return null;
  return item.holdSeconds[0] * (item.perSide ? 2 : 1);
}

/** The side a program set is for (Phase 30): sets are split evenly between `sides`. */
export function sideOf(item: SessionItem, setNo: number): 'right' | 'left' | null {
  if (!item.sides?.length) return null;
  const perSide = Math.max(1, Math.round(item.sets / item.sides.length));
  return item.sides[Math.min(item.sides.length - 1, Math.floor((setNo - 1) / perSide))];
}

/** "Right side · set 2 of 4" for a program set split by side (Phase 30). */
export function sideSet(
  item: SessionItem,
  setNo: number,
): { side: 'right' | 'left'; n: number; total: number } | null {
  const side = sideOf(item, setNo);
  if (!side) return null;
  const perSide = Math.max(1, Math.round(item.sets / item.sides!.length));
  return { side, n: ((setNo - 1) % perSide) + 1, total: perSide };
}
