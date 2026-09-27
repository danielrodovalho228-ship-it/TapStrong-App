import type { Exercise } from '../exercises/types';
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
 * - joint care and 60+ progress more slowly: +1 rep before any load;
 * - reps missed in the last 2 sessions → keep; missed in the last 3 → lower
 *   one step;
 * - a deload week keeps the load (the volume drops instead).
 */
export type Session = { endedAt: string; logs: SetLog[] };

export type LoadAdvice =
  | { kind: 'first' }
  | { kind: 'load'; load: number; unit: LoadUnit; change: 'up' | 'same' | 'down' }
  | { kind: 'reps'; reps: number; change: 'up' | 'same' }
  | null;

export const UPPER_STEP: Record<LoadUnit, number> = { lb: 5, kg: 2.5 };
export const LOWER_STEP: Record<LoadUnit, number> = { lb: 10, kg: 5 };
const MAX_EASY_RPE = 8;

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

function toUnit(value: number, from: LoadUnit, to: LoadUnit): number {
  if (from === to) return value;
  const kg = from === 'lb' ? value * 0.45359237 : value;
  const out = to === 'lb' ? kg / 0.45359237 : kg;
  return Math.round(out / UPPER_STEP[to]) * UPPER_STEP[to];
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
  deload?: boolean;
}): LoadAdvice {
  const { sessions, range, exercise, unit } = input;
  const [bottom, top] = range;
  const loadedMove = exercise.loaded;
  const lastLoaded = sessions[0]?.logs.filter((l) => l.load != null && l.load > 0).at(-1);

  if (loadedMove && !lastLoaded) return { kind: 'first' };

  const lastTwo = sessions.slice(0, 2);
  const upDue = lastTwo.length === 2 && lastTwo.every((s) => allTop(s, top)) && !input.deload;
  const missedTwo = lastTwo.length === 2 && lastTwo.every((s) => missed(s, bottom));
  const missedThree = sessions.length >= 3 && sessions.slice(0, 3).every((s) => missed(s, bottom));
  const slow = input.mode === 'senior' || !!input.jointCare;
  const minor = input.mode === 'teen' || input.mode === 'child';

  if (!loadedMove) {
    const best = Math.max(0, ...(sessions[0]?.logs.map(done) ?? [0]));
    if (!sessions.length) return null;
    return upDue
      ? { kind: 'reps', reps: best + 1, change: 'up' }
      : { kind: 'reps', reps: Math.max(bottom, best), change: 'same' };
  }

  const load = toUnit(lastLoaded!.load!, lastLoaded!.unit ?? unit, unit);
  const step = (isLowerBody(exercise) && !minor ? LOWER_STEP : UPPER_STEP)[unit];
  if (upDue) {
    if (slow) {
      // +1 rep before any load: once the last session already beat the top
      // of the range by a rep, the load goes up one step.
      const beatTop = sessions[0].logs.every((l) => done(l) > top);
      if (!beatTop) return { kind: 'reps', reps: top + 1, change: 'up' };
    }
    return { kind: 'load', load: load + step, unit, change: 'up' };
  }
  if (missedThree) return { kind: 'load', load: Math.max(0, load - step), unit, change: 'down' };
  if (missedTwo) return { kind: 'load', load, unit, change: 'same' };
  return { kind: 'load', load, unit, change: 'same' };
}

/** "3 × 10–12 · 25 lb" (A4): the dose line with the suggested load. */
export function loadText(advice: LoadAdvice, unitLabel: string): string | null {
  return advice?.kind === 'load' && advice.load > 0 ? `${advice.load} ${unitLabel}` : null;
}

/** The advice for one item of a stored workout, from the person's history. */
export function adviceForItem(input: {
  workouts: WorkoutRecord[];
  workoutId: string;
  item: SessionItem;
  exercise: Exercise | undefined;
  unit: LoadUnit;
  generator: Pick<GeneratorInput, 'mode' | 'restrictions' | 'painAreas' | 'movementLimits'> & {
    deload?: boolean;
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
    deload: input.generator.deload,
  });
}
