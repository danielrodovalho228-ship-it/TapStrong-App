import type { Exercise } from '@/features/exercises/types';
import { muscleByKey } from '@/features/muscles';
import type { AppMode } from '@/features/profile/age';
import type { WorkoutRecord } from '@/features/workout/types';
import { localDate, weekStart } from '@/lib/dates';

import { factsFor } from './facts';

/**
 * Moments (Phase 27, C): small, rare, varied surprises at the end of a
 * workout or on Home. Everything here is local, pure and deterministic, so
 * the rules are tested: at most one per workout and about one in three
 * workouts, never the same one twice (numeric milestones have their own
 * number), never during a workout, never paid, never pressure, and minors
 * only get habit, curiosity and map Moments.
 */
export type MomentKind =
  | 'first_workout'
  | 'first_back'
  | 'first_mobility'
  | 'first_week'
  | 'map_new_muscle'
  | 'map_all_back'
  | 'milestone_workouts'
  | 'milestone_reps'
  | 'milestone_sets'
  | 'fact'
  | 'coach_pain'
  | 'birthday'
  | 'app_month'
  | 'app_year'
  | 'repair_even'
  | 'month_highlight';

/** Habit, curiosity and map: the only Moments minors get (no weight, record or body). */
export const MINOR_MOMENT_KINDS: readonly MomentKind[] = [
  'first_workout',
  'first_back',
  'first_mobility',
  'first_week',
  'map_new_muscle',
  'map_all_back',
  'milestone_workouts',
  'fact',
  'app_month',
  'app_year',
  'month_highlight',
];

/** Big milestones always show; the others are drawn (about 1 in 3). */
const BIG_KINDS: readonly MomentKind[] = [
  'first_workout',
  'milestone_workouts',
  'milestone_reps',
  'milestone_sets',
  'app_year',
];

export const WORKOUT_MILESTONES = [10, 25, 50, 100] as const;
export const REPS_MILESTONE = 1000;
export const SETS_MILESTONE = 100;
/** On average a small Moment in 1 of 3 workouts. */
export const SMALL_CHANCE = 1 / 3;
const BACK = ['lats', 'upperBack', 'lowerBack', 'traps', 'rearDelts'];
const DAY = 86_400_000;

export type Moment = {
  /** Unique per person: never shown twice. */
  id: string;
  kind: MomentKind;
  /** i18n params: counts, a muscle key, a pain area, a fact id. */
  params: Record<string, string | number>;
  /** Muscles to light on the small map, if any. */
  muscles?: string[];
  /** The coach asks a question (the answer goes to the history). */
  asks?: boolean;
};

export type ShownMoment = {
  id: string;
  kind: MomentKind;
  at: string;
  workoutId?: string | null;
  answer?: 'good' | 'not_yet' | null;
};

export type MomentContext = {
  now: Date;
  /** Per person, so the draw differs between people but not between runs. */
  seed: string;
  mode: AppMode;
  enabled: boolean;
  where: 'done' | 'home';
  /** The workout that just ended ("done"). */
  workout?: WorkoutRecord | null;
  workouts: WorkoutRecord[];
  library: Exercise[];
  shown: ShownMoment[];
  daysPerWeek?: number;
  birthMonth?: number;
  installedAt?: string | null;
  /** Repair tests where the weaker side caught up (saved with the result). */
  repairEven?: { testKey: string; side: 'left' | 'right'; at: string }[];
};

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';

/** FNV-1a: a small, stable hash for the seeded draw. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) from the person, the week and the workout. */
export function draw(seed: string, now: Date, workoutId: string): number {
  const week = weekStart(localDate(now), 1);
  return hash(`${seed}|${week}|${workoutId}`) / 0x1_0000_0000;
}

function musclesOf(w: WorkoutRecord, byId: Map<string, Exercise>): Set<string> {
  const out = new Set<string>();
  for (const l of w.logs) {
    const e = byId.get(l.exerciseId);
    for (const m of e?.muscles ?? []) out.add(m.muscleKey);
  }
  return out;
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

/** Every Moment that would fit right now, before the rarity rules. */
export function candidates(ctx: MomentContext): Moment[] {
  const out: Moment[] = [];
  const byId = new Map(ctx.library.map((e) => [e.id, e]));
  const done = ctx.workouts.filter(finished);
  const regular = done.filter((w) => w.kind !== 'mobility');

  if (ctx.where === 'home') {
    const year = ctx.now.getFullYear();
    if (ctx.birthMonth && ctx.birthMonth === ctx.now.getMonth() + 1)
      out.push({ id: `birthday:${year}`, kind: 'birthday', params: {} });
    if (ctx.installedAt) {
      const days = Math.floor((ctx.now.getTime() - Date.parse(ctx.installedAt)) / DAY);
      if (days >= 365) out.push({ id: 'app_year', kind: 'app_year', params: {} });
      else if (days >= 30 && done.length)
        out.push({ id: 'app_month', kind: 'app_month', params: {} });
    }
    out.push(...repairMoments(ctx));
    return out;
  }

  const w = ctx.workout;
  if (!w || w.status !== 'done') return out;
  const before = done.filter((x) => x.id !== w.id);

  // First times.
  if (w.kind !== 'mobility' && !before.some((x) => x.kind !== 'mobility'))
    out.push({ id: 'first_workout', kind: 'first_workout', params: {} });
  const targets = targetsOf(w);
  if (
    targets.some((m) => BACK.includes(m)) &&
    !before.some((x) => targetsOf(x).some((m) => BACK.includes(m)))
  )
    out.push({
      id: 'first_back',
      kind: 'first_back',
      params: {},
      muscles: targets.filter((m) => BACK.includes(m)),
    });
  if (w.kind === 'mobility' && !before.some((x) => x.kind === 'mobility'))
    out.push({ id: 'first_mobility', kind: 'first_mobility', params: {} });
  if (ctx.daysPerWeek) {
    const week = weekStart(localDate(ctx.now), 1);
    const inWeek = (x: WorkoutRecord) =>
      weekStart(localDate(new Date(x.startedAt ?? x.createdAt)), 1) === week;
    const thisWeek = done.filter(inWeek).length;
    if (thisWeek >= ctx.daysPerWeek && before.filter(inWeek).length < ctx.daysPerWeek)
      out.push({ id: 'first_week', kind: 'first_week', params: {} });
  }

  // The map: a muscle new on the map, all of the back this month.
  const earlier = new Set(before.flatMap((x) => [...musclesOf(x, byId)]));
  const fresh = [...musclesOf(w, byId)].filter(
    (m) => !earlier.has(m) && (muscleByKey(m)?.views.length ?? 0) > 0,
  );
  if (before.length && fresh.length)
    out.push({
      id: `map_new:${fresh[0]}`,
      kind: 'map_new_muscle',
      params: { muscle: fresh[0] },
      muscles: [fresh[0]],
    });
  const month = localDate(ctx.now).slice(0, 7);
  const monthMuscles = new Set(
    done
      .filter((x) => localDate(new Date(x.startedAt ?? x.createdAt)).startsWith(month))
      .flatMap((x) => [...musclesOf(x, byId)]),
  );
  if (BACK.every((m) => monthMuscles.has(m)))
    out.push({ id: `map_all_back:${month}`, kind: 'map_all_back', params: {}, muscles: BACK });

  // Milestones.
  const n = regular.length;
  if (w.kind !== 'mobility' && (WORKOUT_MILESTONES as readonly number[]).includes(n))
    out.push({ id: `workouts:${n}`, kind: 'milestone_workouts', params: { count: n } });
  const reps = (list: WorkoutRecord[]) =>
    list.reduce((s, x) => s + x.logs.reduce((a, l) => a + (l.reps ?? 0), 0), 0);
  if (reps(before) < REPS_MILESTONE && reps(done) >= REPS_MILESTONE)
    out.push({ id: 'reps:1000', kind: 'milestone_reps', params: { count: REPS_MILESTONE } });
  const sets = (list: WorkoutRecord[]) =>
    list.reduce((s, x) => s + x.logs.filter((l) => l.reps != null).length, 0);
  if (sets(before) < SETS_MILESTONE && sets(done) >= SETS_MILESTONE)
    out.push({ id: 'sets:100', kind: 'milestone_sets', params: { count: SETS_MILESTONE } });

  // Today's muscle: one short, true fact.
  const main = targets[0] ?? null;
  const parent = main ? (muscleByKey(main)?.parentKey ?? main) : null;
  const pool = factsFor(main).length ? factsFor(main) : factsFor(parent);
  const unseen = pool.filter((f) => !ctx.shown.some((s) => s.id === `fact:${f.id}`));
  if (unseen.length) {
    const fact = unseen[hash(`${ctx.seed}|${w.id}`) % unseen.length];
    out.push({
      id: `fact:${fact.id}`,
      kind: 'fact',
      params: { fact: fact.id },
      muscles: main ? [main] : [],
    });
  }

  // The coach remembers: a pain last week, none today.
  const since = ctx.now.getTime() - 10 * DAY;
  const lastPain = before
    .flatMap((x) => x.pains)
    .filter((p) => Date.parse(p.reportedAt) >= since && p.area !== 'other')
    .at(-1);
  if (lastPain && !w.pains.length)
    out.push({
      id: `coach_pain:${localDate(new Date(lastPain.reportedAt))}`,
      kind: 'coach_pain',
      params: { area: lastPain.area },
      asks: true,
    });

  out.push(...repairMoments(ctx));
  return out;
}

/** Repair (adults and 60+): the weaker side caught up in the 2-minute test. */
function repairMoments(ctx: MomentContext): Moment[] {
  return (ctx.repairEven ?? []).map((r) => ({
    id: `repair_even:${r.testKey}:${localDate(new Date(r.at))}`,
    kind: 'repair_even' as const,
    params: { side: r.side },
  }));
}

/**
 * The Moment to show now, or null. The rules: turned on in Settings;
 * nothing a minor shouldn't get; never twice; one per workout (the same one
 * again on a re-render); 60+ at most one a week; big milestones always, the
 * small ones in about 1 of 3 workouts (a draw seeded by person and week).
 */
export function pickMoment(ctx: MomentContext): Moment | null {
  if (!ctx.enabled) return null;
  const minor = ctx.mode === 'teen' || ctx.mode === 'child';
  const shownIds = new Set(ctx.shown.map((s) => s.id));

  if (ctx.where === 'done' && ctx.workout) {
    // Already chosen for this workout: the same one, never a second.
    const chosen = ctx.shown.find((s) => s.workoutId === ctx.workout!.id);
    if (chosen) return null;
  }
  if (ctx.where === 'home') {
    const today = localDate(ctx.now);
    if (ctx.shown.some((s) => localDate(new Date(s.at)) === today)) return null;
  }
  if (ctx.mode === 'senior') {
    const weekAgo = ctx.now.getTime() - 7 * DAY;
    if (ctx.shown.some((s) => Date.parse(s.at) > weekAgo && s.kind !== 'month_highlight'))
      return null;
  }

  const list = candidates(ctx).filter(
    (m) => !shownIds.has(m.id) && (!minor || MINOR_MOMENT_KINDS.includes(m.kind)),
  );
  if (!list.length) return null;
  const big = list.find((m) => BIG_KINDS.includes(m.kind));
  if (big) return big;
  if (ctx.where === 'home') return list[0];
  const workoutId = ctx.workout?.id ?? '';
  if (draw(ctx.seed, ctx.now, workoutId) >= SMALL_CHANCE) return null;
  return list[hash(`${ctx.seed}|pick|${workoutId}`) % list.length];
}

/** The month's highlight muscle as a Moment (Phase 27, C3), shown on the month screen. */
export function monthHighlight(blockNo: number, muscle: string): Moment {
  return {
    id: `month:${blockNo}`,
    kind: 'month_highlight',
    params: { muscle },
    muscles: [muscle],
  };
}
