import { HOUR_MS } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import { MUSCLES, muscleByKey, muscleFamily, type MovementGroup } from '../muscles';
import { recoveryHoursFor, type AppMode } from '../profile/age';

import type { WorkoutRecord } from './types';

/**
 * Body colors — SPEC §4 and §8. Only main work turns muscles red; warm-up,
 * cool-down and finishers never do. Primary muscles show at full intensity;
 * secondary muscles show as "also worked", one step lighter.
 */
export type RecoveryState = 'fresh' | 'recovering' | 'almost' | 'neutral' | 'neglected';

/** `muscle_activity` (SPEC §7), derived from the workout history. */
export type MuscleActivity = {
  lastPrimaryAt?: string;
  lastSecondaryAt?: string;
  /** Main-work sets in the last 7 days where the muscle was primary. */
  sets7d: number;
};

export const NEGLECTED_HOURS = 5 * 24;
const SECONDARY_SHIFT_HOURS = 24;

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';

export function muscleActivity(
  history: WorkoutRecord[],
  library: Exercise[],
  now: Date,
): Record<string, MuscleActivity> {
  const byId = new Map(library.map((e) => [e.id, e]));
  const out: Record<string, MuscleActivity> = {};
  const touch = (key: string) => (out[key] ??= { sets7d: 0 });
  const later = (a: string | undefined, b: string) => (!a || b > a ? b : a);

  for (const w of history.filter(finished)) {
    const main = new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));
    for (const log of w.logs) {
      if (!main.has(log.itemId)) continue;
      for (const m of byId.get(log.exerciseId)?.muscles ?? []) {
        if (m.role === 'primary') {
          const a = touch(m.muscleKey);
          a.lastPrimaryAt = later(a.lastPrimaryAt, log.loggedAt);
          if (now.getTime() - Date.parse(log.loggedAt) <= 7 * 24 * HOUR_MS) a.sets7d++;
        } else if (m.role === 'secondary') {
          const a = touch(m.muscleKey);
          a.lastSecondaryAt = later(a.lastSecondaryAt, log.loggedAt);
        }
      }
    }
  }
  return out;
}

/** Color band for hours since training. 60+ stay peach until 96 h. */
export function stateForHours(hours: number, mode: AppMode): RecoveryState {
  if (hours < 24) return 'fresh';
  if (hours < 48) return 'recovering';
  if (hours < recoveryHoursFor(mode)) return 'almost';
  if (hours >= NEGLECTED_HOURS) return 'neglected';
  return 'neutral';
}

const RANK: Record<RecoveryState, number> = {
  fresh: 4,
  recovering: 3,
  almost: 2,
  neglected: 1,
  neutral: 0,
};

const hoursSince = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / HOUR_MS;

/**
 * State for every hotspot muscle. Grey-blue ("not trained in 5+ days") is
 * shown only for muscles the user tracks — their goal muscles and anything
 * trained before — and only once they have finished a workout, so a new
 * user's body is not painted grey.
 */
export function bodyStates(
  activity: Record<string, MuscleActivity>,
  now: Date,
  mode: AppMode,
  tracked: string[],
): Record<string, RecoveryState> {
  const hasHistory = Object.values(activity).some((a) => a.lastPrimaryAt);
  const trackedSet = new Set(tracked.flatMap(muscleFamily));
  const out: Record<string, RecoveryState> = {};
  for (const m of MUSCLES) {
    const a = activity[m.key];
    let state: RecoveryState = 'neutral';
    if (a?.lastPrimaryAt) state = stateForHours(hoursSince(a.lastPrimaryAt, now), mode);
    if (a?.lastSecondaryAt) {
      const s = stateForHours(hoursSince(a.lastSecondaryAt, now) + SECONDARY_SHIFT_HOURS, mode);
      if (s !== 'neglected' && RANK[s] > RANK[state]) state = s;
    }
    if (state === 'neutral' && hasHistory && trackedSet.has(m.key) && !a?.lastPrimaryAt) {
      state = 'neglected';
    }
    out[m.key] = state;
  }
  return out;
}

export type BigGroup = Exclude<MovementGroup, 'core'>;
const BIG_GROUPS: BigGroup[] = ['legs', 'pull', 'push'];

/** Muscles of a movement group that released main work trains as primary. */
export function groupMuscles(group: MovementGroup, library: Exercise[]): string[] {
  const trained = new Set(
    library
      .filter((e) => e.parts.includes('main'))
      .flatMap((e) => e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey)),
  );
  return MUSCLES.filter(
    (m) => m.movementGroup === group && m.views.length > 0 && trained.has(m.key),
  ).map((m) => m.key);
}

/**
 * The push / pull / legs group left untrained longest (5+ days or never),
 * for the Done screen's "Finish strong" suggestion (mockup 14).
 */
export function neglectedGroup(
  activity: Record<string, MuscleActivity>,
  library: Exercise[],
  now: Date,
): BigGroup | null {
  let best: { group: BigGroup; hours: number } | null = null;
  for (const group of BIG_GROUPS) {
    const muscles = groupMuscles(group, library);
    if (!muscles.length) continue;
    const latest = muscles
      .map((k) => activity[k]?.lastPrimaryAt)
      .filter((t): t is string => !!t)
      .sort()
      .pop();
    const hours = latest ? hoursSince(latest, now) : Infinity;
    if (hours >= NEGLECTED_HOURS && (!best || hours > best.hours)) best = { group, hours };
  }
  return best?.group ?? null;
}

/** The movement group of a muscle key, when known. */
export const groupOfMuscle = (key: string) => muscleByKey(key)?.movementGroup;
