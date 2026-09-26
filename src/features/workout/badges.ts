import type { Exercise } from '../exercises/types';
import { muscleByKey, type MovementGroup } from '../muscles';

import type { StreakState } from './streak';
import type { WorkoutRecord } from './types';

/**
 * Badges (mockup 24). Earned from local history only; the database keeps a
 * copy once the account is saved. Keys match `badges.key` in Postgres.
 */
export const BADGE_KEYS = [
  'first_workout',
  'streak_7',
  'first_pr',
  'full_body_week',
  'streak_30',
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export type BadgeStatus = { key: BadgeKey; earned: boolean; progress?: [number, number] };

const ZONES: MovementGroup[] = ['push', 'pull', 'legs', 'core'];
const DAY_MS = 86_400_000;

const finished = (w: WorkoutRecord) =>
  (w.status === 'done' || w.status === 'partial') && w.logs.length > 0;

/** Heaviest load per exercise per finished session, oldest session first. */
function maxLoads(history: WorkoutRecord[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const sorted = history
    .filter(finished)
    .sort((a, b) => ((a.endedAt ?? '') < (b.endedAt ?? '') ? -1 : 1));
  for (const w of sorted) {
    const best = new Map<string, number>();
    for (const l of w.logs) {
      if (l.load == null) continue;
      const kg = l.unit === 'lb' ? l.load * 0.45359237 : l.load;
      best.set(l.exerciseId, Math.max(best.get(l.exerciseId) ?? 0, kg));
    }
    for (const [id, kg] of best) out.set(id, [...(out.get(id) ?? []), kg]);
  }
  return out;
}

/** Movement groups trained as main work in the last 7 days. */
export function zonesThisWeek(
  history: WorkoutRecord[],
  library: Exercise[],
  now: Date,
): MovementGroup[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const groups = new Set<MovementGroup>();
  for (const w of history.filter(finished)) {
    const main = new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));
    for (const l of w.logs) {
      if (!main.has(l.itemId) || now.getTime() - Date.parse(l.loggedAt) > 7 * DAY_MS) continue;
      for (const m of byId.get(l.exerciseId)?.muscles ?? []) {
        const g = m.role === 'primary' ? muscleByKey(m.muscleKey)?.movementGroup : undefined;
        if (g) groups.add(g);
      }
    }
  }
  return ZONES.filter((z) => groups.has(z));
}

export function badgeStatus(
  history: WorkoutRecord[],
  streak: StreakState,
  library: Exercise[],
  now: Date,
): BadgeStatus[] {
  const loads = [...maxLoads(history).values()];
  const pr = loads.some((series) =>
    series.some((kg, i) => i > 0 && kg > Math.max(...series.slice(0, i))),
  );
  const zones = zonesThisWeek(history, library, now).length;
  return [
    { key: 'first_workout', earned: history.some(finished) },
    { key: 'streak_7', earned: streak.best >= 7, progress: [Math.min(streak.current, 7), 7] },
    { key: 'first_pr', earned: pr },
    { key: 'full_body_week', earned: zones === ZONES.length, progress: [zones, ZONES.length] },
    { key: 'streak_30', earned: streak.best >= 30, progress: [Math.min(streak.current, 30), 30] },
  ];
}
