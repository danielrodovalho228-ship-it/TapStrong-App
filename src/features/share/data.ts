import { demoPoster } from '@/features/exercises/videos';
import type { Exercise } from '@/features/exercises/types';
import { MINOR_MOMENT_KINDS, type Moment } from '@/features/moments/engine';
import type { MonthSummary } from '@/features/month/summary';
import { muscleByKey } from '@/features/muscles';
import type { AppMode } from '@/features/profile/age';
import { lightOrder } from '@/features/workout/lightOrder';
import { mainSetCounts } from '@/features/workout/flow';
import type { WorkoutRecord } from '@/features/workout/types';
import { addDays, localDate, weekStart, type WeekStartDay } from '@/lib/dates';

import { funComparison, weekVolumeKg } from './fun';
import type {
  AchievementCard,
  CardData,
  ExerciseCard,
  FunCard,
  LitMuscles,
  MonthCard,
  MuscleCard,
  ShareTemplate,
  WeekCard,
  WorkoutCard,
} from './types';

/**
 * Builders for the card data (Phase 28, A3). Each one copies only what its
 * picture shows: counts, minutes, muscle keys, an exercise id. Never the
 * body, weight, measurements, BMI, place, exact time, pain, restrictions or
 * anyone's name (the name, when turned on, is chrome, adults only).
 */

const drawn = (k: string) => (muscleByKey(k)?.views.length ?? 0) > 0;

function litFrom(targets: string[], worked: string[]): LitMuscles {
  const lit: LitMuscles = {};
  for (const m of worked) if (drawn(m)) lit[m] = 'also';
  for (const m of targets) if (drawn(m)) lit[m] = 'main';
  return lit;
}

function targetsOf(w: WorkoutRecord): string[] {
  return [
    ...new Set(
      w.session.items
        .filter((i) => i.role === 'main' && i.targetMuscle)
        .map((i) => i.targetMuscle as string),
    ),
  ];
}

/** "Workout done" (B1), or its sticker variant. */
export function workoutCard(
  w: WorkoutRecord,
  library: Exercise[],
  streak: number,
  now: Date,
  template: 'workout' | 'sticker' = 'workout',
): WorkoutCard {
  const targets = targetsOf(w).slice(0, 3);
  const minutes = Math.max(
    1,
    Math.round(
      (Date.parse(w.endedAt ?? now.toISOString()) - Date.parse(w.startedAt ?? w.createdAt)) / 60000,
    ),
  );
  const exercises = new Set(
    w.logs
      .filter((l) => w.session.items.find((i) => i.id === l.itemId)?.role === 'main')
      .map((l) => l.exerciseId),
  ).size;
  return {
    template,
    targets,
    lit: litFrom(targets, lightOrder(w, library)),
    minutes,
    exercises,
    sets: mainSetCounts(w).done,
    streak,
  };
}

/** "Today I trained: glutes 🔥" (B2). */
export function muscleCard(w: WorkoutRecord): MuscleCard | null {
  const main = targetsOf(w).find(drawn);
  return main ? { template: 'muscle', muscle: main } : null;
}

/** The exercise sheet (B3): the exercise, its muscles, the own-sex poster. */
export function exerciseCard(e: Exercise, sex: 'f' | 'm' | null): ExerciseCard {
  return {
    template: 'exercise',
    exerciseId: e.id,
    primary: e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey),
    secondary: e.muscles.filter((m) => m.role !== 'primary').map((m) => m.muscleKey),
    poster: demoPoster(e.slug, sex) !== null,
  };
}

/** A Moment as a card (B4). */
export function achievementCard(m: Pick<Moment, 'kind' | 'params' | 'muscles'>): AchievementCard {
  const lit: LitMuscles = {};
  for (const k of m.muscles ?? []) if (drawn(k)) lit[k] = 'main';
  // Only counts, a muscle key, a fact id or a side: never a pain area.
  const params = Object.fromEntries(
    Object.entries(m.params).filter(([k]) => ['count', 'muscle', 'fact', 'side'].includes(k)),
  );
  return { template: 'achievement', kind: m.kind, params, lit };
}

/** "My week" (B5): days trained and the week's lit map. */
export function weekCard(
  workouts: WorkoutRecord[],
  library: Exercise[],
  now: Date,
  startsOn: WeekStartDay,
): WeekCard {
  const start = weekStart(localDate(now), startsOn);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = workouts.filter(
    (w) =>
      (w.status === 'done' || w.status === 'partial') &&
      days.includes(localDate(new Date(w.startedAt ?? w.createdAt))),
  );
  const trained = new Set(inWeek.map((w) => localDate(new Date(w.startedAt ?? w.createdAt))));
  const lit: LitMuscles = {};
  for (const w of inWeek) Object.assign(lit, litFrom(targetsOf(w), lightOrder(w, library)));
  for (const w of inWeek) for (const m of targetsOf(w)) if (drawn(m)) lit[m] = 'main';
  return {
    template: 'week',
    days: days.map((d) => trained.has(d)),
    lit,
    workouts: inWeek.filter((w) => w.kind !== 'mobility').length,
  };
}

/** "My month" (B5), from the Phase 26 summary. */
export function monthCard(s: MonthSummary): MonthCard {
  const lit: LitMuscles = {};
  const perWeek = (m: string) => (s.sets[m] ?? 0) / Math.max(1, s.weeks);
  for (const [m, n] of Object.entries(s.sets)) {
    if (!n) continue;
    const keys = drawn(m)
      ? [m]
      : m === 'chest'
        ? ['upperChest', 'midChest', 'lowerChest']
        : m === 'abs'
          ? ['upperAbs', 'lowerAbs']
          : [];
    for (const k of keys) lit[k] = perWeek(m) >= 4 ? 'main' : 'also';
  }
  return {
    template: 'month',
    highlight: s.strong?.muscle ?? null,
    workouts: s.workouts,
    days: s.trainedDays.length,
    minutes: s.minutes,
    lit,
    monthOf: addDays(s.to, -1),
  };
}

/** The fun comparison (B6), adults only and only with loads logged. */
export function funCard(
  workouts: WorkoutRecord[],
  now: Date,
  startsOn: WeekStartDay,
): FunCard | null {
  const fit = funComparison(weekVolumeKg(workouts, now, startsOn));
  return fit ? { template: 'fun', ...fit } : null;
}

/**
 * Which cards an age mode may share (Phase 28, E): minors only the muscle of
 * the day, the workout (no load on it anyway) and habit achievements; 60+
 * and adults all of them.
 */
export function templatesFor(mode: AppMode): ShareTemplate[] {
  if (mode === 'child' || mode === 'teen') return ['muscle', 'workout', 'sticker', 'achievement'];
  return ['workout', 'sticker', 'muscle', 'exercise', 'achievement', 'week', 'month', 'fun'];
}

/** Whether this card may be shared in this mode (achievements: habit kinds for minors). */
export function allowedCard(card: CardData, mode: AppMode): boolean {
  if (!templatesFor(mode).includes(card.template)) return false;
  if (card.template === 'achievement' && (mode === 'teen' || mode === 'child'))
    return (MINOR_MOMENT_KINDS as readonly string[]).includes(card.kind);
  return true;
}

/**
 * "My 4 weeks" from the check-in (the last 28 days), drawn as a month card
 * when no closed month is at hand.
 */
export function rangeMonthCard(
  workouts: WorkoutRecord[],
  library: Exercise[],
  now: Date,
  days = 28,
): MonthCard {
  const since = now.getTime() - days * 86_400_000;
  const done = workouts.filter(
    (w) =>
      (w.status === 'done' || w.status === 'partial') &&
      Date.parse(w.endedAt ?? w.createdAt) >= since,
  );
  const lit: LitMuscles = {};
  for (const w of done) Object.assign(lit, litFrom(targetsOf(w), lightOrder(w, library)));
  for (const w of done) for (const m of targetsOf(w)) if (drawn(m)) lit[m] = 'main';
  const minutes = done.reduce(
    (n, w) =>
      n +
      Math.max(
        1,
        Math.round(
          (Date.parse(w.endedAt ?? now.toISOString()) - Date.parse(w.startedAt ?? w.createdAt)) /
            60000,
        ),
      ),
    0,
  );
  const counts = new Map<string, number>();
  for (const w of done) for (const m of targetsOf(w)) counts.set(m, (counts.get(m) ?? 0) + 1);
  const highlight = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    template: 'month',
    highlight,
    workouts: done.filter((w) => w.kind !== 'mobility').length,
    days: new Set(done.map((w) => localDate(new Date(w.startedAt ?? w.createdAt)))).size,
    minutes,
    lit,
    monthOf: localDate(now),
  };
}
