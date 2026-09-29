import type { Exercise } from '../exercises/types';
import { isMachineItem } from '../equipment/catalog';
import { needsJointCare } from '../generator/filters';
import type { GeneratorInput, SessionItem } from '../generator/types';
import { muscleByKey } from '../muscles';
import type { AppMode } from '../profile/age';

import { pastSessions } from './progression';
import type { LoadUnit, SetLog, WorkoutRecord } from './types';

/**
 * Suggested load and progression (improvements v1, A4). Deterministic:
 * - first time with a loaded move: ask for "a weight you could lift 2 more
 *   times" and log it;
 * - every set at the top of the range with effort (RPE) 8 or less in the last
 *   2 sessions → more: +5 lb / +2.5 kg upper body, +10 lb / +5 kg lower body,
 *   or +1 rep for bodyweight and bands;
 * - both of those sessions at the current load: one step, then two more
 *   sessions before the next (QA R6 P2: it went up twice in a row);
 * - joint care and 60+ progress more slowly: +1 rep before any load;
 * - 60+ and heart or blood-pressure conditions step by what the equipment
 *   really offers (Daniel, Phase 18: dumbbells and barbells 5 lb, machines
 *   and cables the next plate of the stack); when that step is more than
 *   ~10% of the load, reps go up first, to the top of the range + 2, and
 *   only then the load (QA R6 P2: 25 → 35 lb was +40%);
 * - bodyweight at the top of the range for 4 sessions: try a harder version;
 * - reps missed in the last 2 sessions → keep; missed in the last 3 → lower
 *   one step;
 * - a deload week keeps the load (the volume drops instead).
 */
export type Session = { endedAt: string; logs: SetLog[] };

export type LoadAdvice =
  | { kind: 'first' }
  | {
      kind: 'load';
      load: number;
      unit: LoadUnit;
      change: 'up' | 'same' | 'down';
      /** Already at the lightest real load and still missing reps: an easier version. */
      easier?: boolean;
    }
  /** More reps; a loaded move keeps its last load (QA R4-10). */
  | {
      kind: 'reps';
      reps: number;
      change: 'up' | 'same';
      load?: number;
      unit?: LoadUnit;
      /** Bodyweight at the top of the range for 4 sessions: a harder version next. */
      harder?: boolean;
    }
  | null;

export const UPPER_STEP: Record<LoadUnit, number> = { lb: 5, kg: 2.5 };
export const LOWER_STEP: Record<LoadUnit, number> = { lb: 10, kg: 5 };
const MAX_EASY_RPE = 8;
/** Sessions at the top of the range before a harder bodyweight version. */
export const HARDER_AFTER = 4;
/** A step over this share of the load is too big for 60+ and heart / BP. */
const GENTLE_SHARE = 0.1;

/**
 * The smallest real load step for the exercise's equipment: dumbbells come
 * in 5 lb (2 kg) pairs, barbells take 2.5 lb (1.25 kg) a side, and machine
 * and cable stacks move one plate (10 lb / 5 kg on most stacks). Null for
 * equipment with no weight steps.
 */
export function equipmentStep(e: Pick<Exercise, 'equipment'>, unit: LoadUnit): number | null {
  const has = (...items: string[]) => e.equipment.some((q) => items.includes(q));
  if (has('barbell', 'ez_bar', 'trap_bar', 'smith_machine', 'landmine', 'weight_plates'))
    return { lb: 5, kg: 2.5 }[unit];
  if (has('dumbbells')) return { lb: 5, kg: 2 }[unit];
  if (has('kettlebells')) return { lb: 10, kg: 4 }[unit];
  if (e.equipment.some(isMachineItem)) return { lb: 10, kg: 5 }[unit];
  return null;
}

const LOWER_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'calf',
  'knee_extension',
  'knee_flexion',
  'hip_isolation',
];

/** Lower-body lifts take the bigger load step. */
export function isLowerBody(e: Pick<Exercise, 'pattern' | 'muscles'>): boolean {
  if (LOWER_PATTERNS.includes(e.pattern)) return true;
  const top = e.muscles.find((m) => m.role === 'primary')?.muscleKey;
  const parent = top ? (muscleByKey(top)?.parentKey ?? top) : null;
  return !!parent && muscleByKey(parent)?.movementGroup === 'legs';
}

/**
 * One rounding rule for a load shown in another unit (QA R4 P2): the same
 * unit is shown as logged; a converted load rounds to the nearest plate step
 * (5 lb / 2.5 kg), in the workout, on the exercise page and on the rest screen.
 */
export function convertLoad(value: number, from: LoadUnit, to: LoadUnit): number {
  if (from === to) return value;
  const kg = from === 'lb' ? value * 0.45359237 : value;
  const out = to === 'lb' ? kg / 0.45359237 : kg;
  return Math.round(out / UPPER_STEP[to]) * UPPER_STEP[to];
}
const toUnit = convertLoad;

/** No step is bigger than this share of the current load (QA R8-07). */
const MAX_STEP_SHARE = 0.25;

/**
 * One load step (QA R8-07: a 16 kg kettlebell went to 24 kg). Kettlebells
 * always move one bell; other equipment moves its real step, or for adult
 * lower-body lifts the bigger step rounded to it, never more than ~25% of
 * the current load and never less than one real step.
 */
function loadStep(o: {
  equip: number | null;
  baseStep: number;
  load: number;
  oneStep: boolean;
  exercise: Pick<Exercise, 'equipment'>;
}): number {
  const { equip, baseStep, load } = o;
  if (!equip) return baseStep;
  if (o.oneStep || o.exercise.equipment.includes('kettlebells')) return equip;
  // Nearest real step; a tie goes to the smaller one (5 kg on 2 kg dumbbells → 4 kg).
  const wanted = Math.max(equip, Math.round(baseStep / equip - 1e-9) * equip);
  const cap = Math.max(equip, Math.floor((load * MAX_STEP_SHARE) / equip + 1e-9) * equip);
  return Math.min(wanted, cap);
}

const done = (l: SetLog) => l.reps ?? l.seconds ?? 0;
const allTop = (s: Session, top: number) =>
  s.logs.length > 0 &&
  s.logs.every((l) => done(l) >= top && (l.rpe ?? MAX_EASY_RPE) <= MAX_EASY_RPE);
const missed = (s: Session, bottom: number) => s.logs.some((l) => done(l) < bottom);

export function loadAdvice(input: {
  /** Past finished sessions with this exercise, most recent first. */
  sessions: Session[];
  range: [number, number];
  exercise: Pick<Exercise, 'loaded' | 'pattern' | 'muscles' | 'equipment'>;
  unit: LoadUnit;
  mode: AppMode;
  jointCare?: boolean;
  /** Heart condition or high blood pressure: gentle load steps. */
  cardio?: boolean;
  deload?: boolean;
}): LoadAdvice {
  const { sessions, range, exercise, unit } = input;
  const [bottom, top] = range;
  const loadedMove = exercise.loaded;
  const lastLoaded = sessions[0]?.logs.filter((l) => l.load != null && l.load > 0).at(-1);

  if (loadedMove && !lastLoaded) return { kind: 'first' };

  const lastTwo = sessions.slice(0, 2);
  // Both sessions must be at the load shown now: a step counts only after two
  // sessions at that load (QA R6 P2).
  const loadOf = (s: Session) => {
    const l = s.logs.filter((x) => x.load != null && x.load > 0).at(-1);
    return l ? toUnit(l.load!, l.unit ?? unit, unit) : null;
  };
  const sameLoad =
    !loadedMove || (lastTwo.length === 2 && loadOf(lastTwo[0]) === loadOf(lastTwo[1]));
  const upDue =
    lastTwo.length === 2 && lastTwo.every((s) => allTop(s, top)) && sameLoad && !input.deload;
  const missedTwo = lastTwo.length === 2 && lastTwo.every((s) => missed(s, bottom));
  const missedThree = sessions.length >= 3 && sessions.slice(0, 3).every((s) => missed(s, bottom));
  // Heart / blood pressure also go reps first before any load (QA R7 P2).
  const slow = input.mode === 'senior' || !!input.jointCare || !!input.cardio;
  const minor = input.mode === 'teen' || input.mode === 'child';

  if (!loadedMove) {
    const best = Math.max(0, ...(sessions[0]?.logs.map(done) ?? [0]));
    if (!sessions.length) return null;
    // At the top of the range for 4 sessions: a harder version (QA R6 P2).
    const lastFour = sessions.slice(0, HARDER_AFTER);
    if (lastFour.length === HARDER_AFTER && lastFour.every((s) => allTop(s, top)) && !input.deload)
      return { kind: 'reps', reps: top, change: 'same', harder: true };
    // Never past the top of the range (QA R5-02: 16 for a 10–15 target).
    return upDue && best < top
      ? { kind: 'reps', reps: best + 1, change: 'up' }
      : { kind: 'reps', reps: Math.min(top, Math.max(bottom, best)), change: 'same' };
  }

  const equip = equipmentStep(exercise, unit);
  const logged = lastLoaded!.unit ?? unit;
  // A load logged in the other unit lands on a real size of this equipment
  // (QA R7 P2: 32 lb became a "14.5 kg" dumbbell).
  const converted = toUnit(lastLoaded!.load!, logged, unit);
  const load =
    equip && logged !== unit ? Math.max(equip, Math.round(converted / equip) * equip) : converted;
  const lower = isLowerBody(exercise) && !minor;
  const baseStep = (lower ? LOWER_STEP : UPPER_STEP)[unit];
  // Steps follow the equipment for everyone (QA R7 P2, R8-07, loadStep).
  // 60+ and heart / blood pressure always take the
  // real step, reps first when it is more than ~10% of the load (Daniel, Phase 18).
  const gentle = input.mode === 'senior' || !!input.cardio;
  const step = loadStep({ equip, baseStep, load, oneStep: gentle || !lower, exercise });
  const bigStep = gentle && step > load * GENTLE_SHARE + 1e-9;
  if (upDue) {
    // Reps above the top before any load: +2 when the step is big, +1 for
    // 60+ and joint care otherwise.
    const ceiling = bigStep ? top + 2 : slow ? top + 1 : top;
    const least = Math.min(...sessions[0].logs.map(done));
    if (least < ceiling)
      return {
        kind: 'reps',
        reps: Math.min(ceiling, Math.max(top + 1, least + 1)),
        change: 'up',
        load,
        unit,
      };
    return { kind: 'load', load: load + step, unit, change: 'up' };
  }
  if (missedThree) {
    // Never below the lightest real load (QA R7 P2: 5 lb → 0 lb): at the
    // lightest, an easier version instead.
    const lightest = equip ?? UPPER_STEP[unit];
    if (load - step < lightest) return { kind: 'load', load, unit, change: 'same', easier: true };
    return { kind: 'load', load: load - step, unit, change: 'down' };
  }
  if (missedTwo) return { kind: 'load', load, unit, change: 'same' };
  return { kind: 'load', load, unit, change: 'same' };
}

/** "3 × 10–12 · 25 lb" (A4): the dose line with the suggested load. */
export function loadText(advice: LoadAdvice, unitLabel: string): string | null {
  const load = adviceLoad(advice);
  return load ? `${load} ${unitLabel}` : null;
}

/**
 * The day's rep target when the advice asks for more reps than the range
 * shows ("Aim for 16" on a 10–15 range): the dose line and the player show
 * it, so logging the range's top isn't a trap (QA R7 P2).
 */
export const advisedReps = (advice: LoadAdvice): number | null =>
  advice?.kind === 'reps' && advice.change === 'up' ? advice.reps : null;

/** The load to start from: the suggested one, or the last one on a "+1 rep" day. */
export const adviceLoad = (advice: LoadAdvice): number | null =>
  advice?.kind === 'load' || advice?.kind === 'reps' ? (advice.load ?? null) || null : null;

/** The advice for one item of a stored workout, from the person's history. */
export function adviceForItem(input: {
  workouts: WorkoutRecord[];
  workoutId: string;
  item: SessionItem;
  exercise: Exercise | undefined;
  unit: LoadUnit;
  generator: Pick<GeneratorInput, 'mode' | 'restrictions' | 'painAreas' | 'movementLimits'> & {
    deload?: boolean;
    stoppedToday?: GeneratorInput['stoppedToday'];
    conditions?: GeneratorInput['conditions'];
  };
}): LoadAdvice {
  const { item, exercise } = input;
  if (!exercise || item.role !== 'main' || item.goal === 'balance') return null;
  const range = item.reps ?? item.holdSeconds;
  if (!range) return null;
  return loadAdvice({
    sessions: pastSessions(input.workouts, item.exerciseId, input.workoutId),
    range,
    exercise,
    unit: input.unit,
    mode: input.generator.mode,
    jointCare: needsJointCare(exercise, input.generator),
    cardio: !!input.generator.conditions?.some(
      (c) => c === 'heart_condition' || c === 'high_blood_pressure',
    ),
    deload: input.generator.deload,
  });
}
