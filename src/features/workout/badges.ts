import type { Exercise } from '../exercises/types';
import { muscleByKey, type MovementGroup } from '../muscles';

import { addDays, localDate, weekStart, type WeekStartDay } from '@/lib/dates';

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
  // Improvements v1, D2 (no global leaderboards; all personal).
  'streak_weeks_4',
  'streak_weeks_12',
  'streak_weeks_26',
  'streak_weeks_52',
  'volume_1',
  'volume_2',
  'volume_3',
  'repair_phase',
  'balance_30',
  'workouts_100',
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

/** Volume milestones in the person's unit (D2). */
export const VOLUME_STEPS: Record<'lb' | 'kg', [number, number, number]> = {
  lb: [10_000, 100_000, 500_000],
  kg: [5_000, 50_000, 250_000],
};
const STREAK_WEEKS = [4, 12, 26, 52] as const;
/** Badges a teen can earn: streak and consistency only, no volume or load (D2). */
const TEEN_BADGES: BadgeKey[] = [
  'first_workout',
  'streak_7',
  'streak_30',
  'full_body_week',
  'streak_weeks_4',
  'streak_weeks_12',
  'streak_weeks_26',
  'streak_weeks_52',
  'balance_30',
  'workouts_100',
];

/** Consecutive calendar weeks with an active day, ending this week or last. */
export function streakWeeks(
  history: WorkoutRecord[],
  now: Date,
  startsOn: WeekStartDay = 0,
): number {
  const weeks = new Set(
    history
      .filter(finished)
      .map((w) => weekStart(localDate(new Date(w.endedAt ?? w.createdAt)), startsOn)),
  );
  let week = weekStart(localDate(now), startsOn);
  if (!weeks.has(week)) week = addDays(week, -7);
  let n = 0;
  while (weeks.has(week)) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

export function badgeStatus(
  history: WorkoutRecord[],
  streak: StreakState,
  library: Exercise[],
  now: Date,
  extra: {
    mode?: string;
    unit?: 'lb' | 'kg';
    repairPhaseDone?: boolean;
    startsOn?: WeekStartDay;
  } = {},
): BadgeStatus[] {
  const loads = [...maxLoads(history).values()];
  const pr = loads.some((series) =>
    series.some((kg, i) => i > 0 && kg > Math.max(...series.slice(0, i))),
  );
  const zones = zonesThisWeek(history, library, now).length;
  const unit = extra.unit ?? 'lb';
  const volumeKg = history
    .filter(finished)
    .reduce(
      (n, w) =>
        n +
        w.logs.reduce(
          (m, l) =>
            m + (l.load && l.reps ? (l.unit === 'lb' ? l.load * 0.45359237 : l.load) * l.reps : 0),
          0,
        ),
      0,
    );
  const volume = unit === 'lb' ? volumeKg / 0.45359237 : volumeKg;
  const byId = new Map(library.map((e) => [e.id, e]));
  const balanceDays = new Set(
    history
      .filter(finished)
      .filter((w) => w.logs.some((l) => byId.get(l.exerciseId)?.pattern === 'balance'))
      .map((w) => localDate(new Date(w.endedAt ?? w.createdAt))),
  ).size;
  const workouts = history.filter((w) => finished(w) && w.kind !== 'mobility').length;
  const weeks = streakWeeks(history, now, extra.startsOn);
  const all: BadgeStatus[] = [
    { key: 'first_workout', earned: history.some(finished) },
    { key: 'streak_7', earned: streak.best >= 7, progress: [Math.min(streak.current, 7), 7] },
    { key: 'first_pr', earned: pr },
    { key: 'full_body_week', earned: zones === ZONES.length, progress: [zones, ZONES.length] },
    { key: 'streak_30', earned: streak.best >= 30, progress: [Math.min(streak.current, 30), 30] },
    ...STREAK_WEEKS.map((n): BadgeStatus => ({
      key: `streak_weeks_${n}` as BadgeKey,
      earned: weeks >= n,
      progress: [Math.min(weeks, n), n],
    })),
    ...VOLUME_STEPS[unit].map((goal, i): BadgeStatus => ({
      key: `volume_${i + 1}` as BadgeKey,
      earned: volume >= goal,
      progress: [Math.min(Math.round(volume), goal), goal],
    })),
    { key: 'repair_phase', earned: !!extra.repairPhaseDone },
    { key: 'balance_30', earned: balanceDays >= 30, progress: [Math.min(balanceDays, 30), 30] },
    { key: 'workouts_100', earned: workouts >= 100, progress: [Math.min(workouts, 100), 100] },
  ];
  const minor = extra.mode === 'teen' || extra.mode === 'child';
  return minor ? all.filter((b) => TEEN_BADGES.includes(b.key)) : all;
}
