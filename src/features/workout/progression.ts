import type { SessionItem } from '../generator/types';

import type { LoadUnit, SetLog, WorkoutRecord } from './types';

/**
 * Progression — SPEC §8:
 * - all reps at the top of the range in the last 2 sessions → suggest more
 *   (+5 lb / +2.5 kg, or +reps for bodyweight);
 * - missed the bottom of the range in the last 2 sessions → hold or reduce.
 */
export type Progression = 'increase' | 'hold' | null;

export const LOAD_STEP: Record<LoadUnit, number> = { lb: 5, kg: 2.5 };

type PastSession = { endedAt: string; logs: SetLog[] };

/** Past finished sessions that did this exercise, most recent first. */
export function pastSessions(
  history: WorkoutRecord[],
  exerciseId: string,
  excludeId?: string,
): PastSession[] {
  return history
    .filter((w) => w.id !== excludeId && (w.status === 'done' || w.status === 'partial'))
    .map((w) => ({
      endedAt: w.endedAt ?? w.createdAt,
      logs: w.logs.filter(
        (l) =>
          l.exerciseId === exerciseId &&
          w.session.items.some((i) => i.id === l.itemId && i.role === 'main'),
      ),
    }))
    .filter((s) => s.logs.length > 0)
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
}

export function progressionFor(
  sessions: PastSession[],
  range: [number, number] | undefined,
): Progression {
  if (!range || sessions.length < 2) return null;
  const lastTwo = sessions.slice(0, 2);
  const value = (l: SetLog) => l.reps ?? l.seconds ?? 0;
  if (lastTwo.every((s) => s.logs.every((l) => value(l) >= range[1]))) return 'increase';
  if (lastTwo.every((s) => s.logs.some((l) => value(l) < range[0]))) return 'hold';
  return null;
}

/** Range the item is logged against: reps, or seconds for holds. */
export const targetRange = (item: SessionItem) => item.reps ?? item.holdSeconds;

/** Starting load for the set logger: last load, plus a step when due. */
export function suggestedLoad(
  sessions: PastSession[],
  progression: Progression,
  unit: LoadUnit,
): number | null {
  const last = sessions[0]?.logs.filter((l) => l.load != null).pop();
  if (!last?.load) return null;
  const inUnit = last.unit === unit ? last.load : convert(last.load, last.unit ?? unit, unit);
  return progression === 'increase' ? inUnit + LOAD_STEP[unit] : inUnit;
}

function convert(value: number, from: LoadUnit, to: LoadUnit): number {
  if (from === to) return value;
  const kg = from === 'lb' ? value * 0.45359237 : value;
  const out = to === 'lb' ? kg / 0.45359237 : kg;
  return Math.round(out / LOAD_STEP[to]) * LOAD_STEP[to];
}
