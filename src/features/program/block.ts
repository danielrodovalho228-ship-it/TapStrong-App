import { daysBetween, type LocalDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import type { GeneratedSession } from '../generator/types';
import { muscleByKey, type MovementGroup } from '../muscles';
import type { AppMode } from '../profile/age';
import type { WorkoutKind } from '../workout/types';

/**
 * Program blocks (improvements v1, A2): 4–6 week blocks, the last week lighter
 * ("Deload": −40% volume). "Week 3 of 5 · Build".
 */
export const DEFAULT_BLOCK_WEEKS = 5;
export const DELOAD_VOLUME = 0.6;

export type BlockWeek = { week: number; of: number; phase: 'build' | 'deload' };

export function blockWeek(
  start: LocalDate,
  today: LocalDate,
  weeks = DEFAULT_BLOCK_WEEKS,
): BlockWeek {
  const of = Math.max(4, Math.min(6, Math.round(weeks)));
  const days = Math.max(0, daysBetween(start, today));
  const week = (Math.floor(days / 7) % of) + 1;
  return { week, of, phase: week === of ? 'deload' : 'build' };
}

/** Sets in a deload week: 40% less volume, never below 1. */
export const deloadSets = (sets: number) => Math.max(1, Math.round(sets * DELOAD_VOLUME));

export type DayName =
  'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullBody' | 'mobility' | 'repair' | 'balance';

/** The day's name from what the session trains (A2). */
export function dayName(
  session: GeneratedSession,
  library: Exercise[],
  kind: WorkoutKind = 'regular',
): DayName {
  if (kind === 'repair') return 'repair';
  if (session.focus === 'balance') return 'balance';
  if (kind === 'mobility' || session.focus === 'mobility') return 'mobility';
  const byId = new Map(library.map((e) => [e.id, e]));
  const groups = new Set<MovementGroup>();
  for (const i of session.items.filter((x) => x.role === 'main')) {
    const e = byId.get(i.exerciseId);
    if (!e || e.pattern === 'balance') continue;
    const top = e.muscles.find((m) => m.role === 'primary')?.muscleKey;
    const parent = top ? (muscleByKey(top)?.parentKey ?? top) : null;
    const g = parent ? muscleByKey(parent)?.movementGroup : undefined;
    if (g) groups.add(g);
  }
  const has = (g: MovementGroup) => groups.has(g);
  if (has('push') && !has('pull') && !has('legs')) return 'push';
  if (has('pull') && !has('push') && !has('legs')) return 'pull';
  if (has('legs') && !has('push') && !has('pull')) return 'lower';
  if ((has('push') || has('pull')) && !has('legs')) return 'upper';
  if (has('legs') && groups.size === 1) return 'legs';
  return 'fullBody';
}

/**
 * Session summary (A3): exercises, minutes and, for adults and 60+ only, an
 * estimated kcal from the stored weight (MET about 5 for moderate strength
 * work). Never for teens or children.
 */
const STRENGTH_MET = 5;
export function sessionSummary(
  session: GeneratedSession,
  mode: AppMode,
  weightKg: number | undefined,
): { exercises: number; minutes: number; kcal: number | null } {
  const exercises = session.items.filter((i) => i.role === 'main').length;
  const minutes = session.estimatedMinutes || session.minutes;
  const adult = mode === 'adult' || mode === 'senior';
  const kcal =
    adult && weightKg && weightKg > 0
      ? Math.round((STRENGTH_MET * weightKg * minutes) / 60 / 10) * 10
      : null;
  return { exercises, minutes, kcal };
}
