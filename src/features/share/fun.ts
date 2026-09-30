import type { WorkoutRecord } from '@/features/workout/types';
import { localDate, weekStart, type WeekStartDay } from '@/lib/dates';

/**
 * Fun comparisons (Phase 28, B6; adults only, only with loads logged): the
 * week's total load lifted (load × reps) as a number of familiar things.
 * Fixed table, rounded typical weights:
 *   giant panda ~100 kg · upright piano ~250 kg · horse ~500 kg ·
 *   small car ~1,000 kg · adult African elephant ~6,000 kg ·
 *   city bus (empty) ~12,000 kg · blue whale ~100,000 kg.
 */
export const THINGS = [
  { key: 'panda', kg: 100, emoji: '🐼' },
  { key: 'piano', kg: 250, emoji: '🎹' },
  { key: 'horse', kg: 500, emoji: '🐎' },
  { key: 'car', kg: 1_000, emoji: '🚗' },
  { key: 'elephant', kg: 6_000, emoji: '🐘' },
  { key: 'bus', kg: 12_000, emoji: '🚌' },
  { key: 'whale', kg: 100_000, emoji: '🐋' },
] as const;

const LB = 0.45359237;

/** Load × reps this week, in kg. */
export function weekVolumeKg(workouts: WorkoutRecord[], now: Date, startsOn: WeekStartDay) {
  const week = weekStart(localDate(now), startsOn);
  let kg = 0;
  for (const w of workouts) {
    if (w.status !== 'done' && w.status !== 'partial') continue;
    if (weekStart(localDate(new Date(w.startedAt ?? w.createdAt)), startsOn) !== week) continue;
    for (const l of w.logs) {
      if (!l.load || !l.reps) continue;
      kg += (l.unit === 'lb' ? l.load * LB : l.load) * l.reps;
    }
  }
  return kg;
}

/**
 * The biggest thing lifted at least once, and how many (rounded to a half,
 * at least 1). Null under a panda's weight: no comparison then.
 */
export function funComparison(kg: number): { thing: string; count: number } | null {
  const fits = THINGS.filter((t) => kg >= t.kg);
  const thing = fits.at(-1);
  if (!thing) return null;
  return { thing: thing.key, count: Math.max(1, Math.round((kg / thing.kg) * 2) / 2) };
}
