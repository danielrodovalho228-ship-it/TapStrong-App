import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';
import { addDays, daysBetween, localDate, weekStart, type LocalDate } from '@/lib/dates';

import type {
  DailyBlock,
  ProgramExercise,
  RehabProgram,
  SessionLayout,
  StrengthTiming,
} from './programs';

/**
 * The daily rhythm (Phase 30 addendum §6.2–6.3): the stretches every day and
 * two strengthening blocks that take turns, so each exercise is done 3 times a
 * week with few exercises a day. The week runs Monday to Sunday, as in the
 * brief (seg A, ter B … dom só alongamentos).
 */

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';
const dayOf = (w: WorkoutRecord) => localDate(new Date(w.endedAt ?? w.startedAt ?? w.createdAt));

/** Monday of the date's week. */
export const programWeekStart = (today: LocalDate) => weekStart(today, 1);
/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (today: LocalDate) => daysBetween(programWeekStart(today), today);

/**
 * Days this week (up to `until`, not including it) each program exercise was
 * done, by slug. Any finished workout counts, the main plan's too: a band row
 * at the gym counts for the program (§6.4 "sem duplicar").
 */
export function weekCounts(
  workouts: WorkoutRecord[],
  program: RehabProgram,
  library: Exercise[],
  from: LocalDate,
  until: LocalDate,
): Record<string, number> {
  const slugOf = new Map(library.map((e) => [e.id, e.slug]));
  const wanted = new Set(program.exercises.map((x) => x.slug));
  const days: Record<string, Set<LocalDate>> = {};
  for (const w of workouts) {
    if (!finished(w)) continue;
    const day = dayOf(w);
    if (day < from || day >= until) continue;
    for (const l of w.logs) {
      const slug = slugOf.get(l.exerciseId);
      if (!slug || !wanted.has(slug)) continue;
      (days[slug] ??= new Set()).add(day);
    }
  }
  return Object.fromEntries(Object.entries(days).map(([slug, d]) => [slug, d.size]));
}

/** How many times a week the exercise is meant to be done in the daily rhythm. */
export function weeklyTarget(program: RehabProgram, ex: ProgramExercise): number {
  return ex.block === 'stretch' ? ex.daysPerWeek[1] : program.daily.perWeek;
}

/**
 * The standard week fitted around the main plan (Daniel, Oct 3): the longer
 * floor block (~26 min) goes on days without a main workout, the shorter
 * standing block (~22 min, "before the workout, as a warm-up") on training
 * days. Still 3 of each Monday to Saturday and Sunday stretches only. Floor
 * days are picked rest days first, as far apart as possible; earliest wins a
 * tie, so the week is deterministic. `training` is Monday first.
 */
export function careWeek(program: RehabProgram, training: boolean[]): (DailyBlock | 'stretch')[] {
  const base = program.daily.week;
  const days = base.flatMap((b, i) => (b === 'stretch' ? [] : [i]));
  const floors = base.filter((b) => b === 'floor').length;
  const picked: number[] = [];
  while (picked.length < floors) {
    const score = (d: number) =>
      (training[d] ? -100 : 0) + Math.min(7, ...picked.map((p) => Math.abs(p - d)));
    const free = days.filter((d) => !picked.includes(d));
    picked.push(free.reduce((best, d) => (score(d) > score(best) ? d : best), free[0]));
  }
  return base.map((b, i) => (b === 'stretch' ? b : picked.includes(i) ? 'floor' : 'standing'));
}

export type DailyPlan = {
  /** The block for today, or only the stretches (Sunday, or both blocks done). */
  block: DailyBlock | 'stretch';
  /** Strengthening exercises today, program numbers in order (block, then catch-up). */
  numbers: number[];
  /** Missed exercises moved to today (§6.3). */
  catchUp: number[];
  /** Missed exercises that did not fit under the daily cap: next week, no doubling. */
  nextWeek: number[];
};

/**
 * Today's plan from what was done this week before today (§6.2–6.3).
 * 1. Sunday is stretches only; Monday to Saturday pick the block that still
 *    needs more sessions this week (on a tie, the standard week's block), so a
 *    swapped or missed day re-plans the rest of the week and keeps 3 each.
 * 2. Exercises of the other block that can no longer reach 3 in the days left
 *    move to today, while the day stays at 12 exercises or fewer.
 * 3. What does not fit goes to next week, never a double dose.
 */
export function dailyPlan(
  program: RehabProgram,
  today: LocalDate,
  counts: Record<string, number>,
  /** Picked by the person for today (§6.2: "o usuário pode trocar o dia"). */
  pick?: DailyBlock,
  /** The standard week to follow (`careWeek`); the program's own by default. */
  week: (DailyBlock | 'stretch')[] = program.daily.week,
): DailyPlan {
  const { daily } = program;
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const need = (n: number) => Math.max(0, daily.perWeek - (counts[byN.get(n)!.slug] ?? 0));
  const blockNeed = (b: DailyBlock) => Math.max(0, ...daily.blocks[b].map(need));
  const idx = weekdayIndex(today);
  const stretches = program.exercises.filter((x) => x.block === 'stretch').length;

  // The blocks of the days left, today first, as the rhythm will pick them.
  const left = { standing: blockNeed('standing'), floor: blockNeed('floor') };
  const slots = { standing: 0, floor: 0 };
  let block: DailyBlock | 'stretch' = 'stretch';
  for (let d = idx; d < 7; d++) {
    const standard = week[d];
    if (standard === 'stretch') continue;
    const forced = d === idx && pick ? pick : null;
    const b: DailyBlock | null =
      forced ??
      (left.standing === 0 && left.floor === 0
        ? null
        : left.standing === left.floor
          ? standard
          : left.standing > left.floor
            ? 'standing'
            : 'floor');
    if (!b) continue;
    if (d === idx) block = b;
    else slots[b]++;
    left[b] = Math.max(0, left[b] - 1);
  }
  if (pick && idx === 6) block = pick;

  const numbers = block === 'stretch' ? [] : daily.blocks[block].filter((n) => need(n) > 0);
  const other: DailyBlock[] =
    block === 'stretch' ? ['standing', 'floor'] : [block === 'standing' ? 'floor' : 'standing'];
  const behind = other.flatMap((b) => daily.blocks[b].filter((n) => need(n) > slots[b]));
  const room = Math.max(0, daily.cap - stretches - numbers.length);
  const catchUp = behind.slice(0, room);
  return {
    block: block !== 'stretch' && !numbers.length && !catchUp.length ? 'stretch' : block,
    numbers: [...numbers, ...catchUp],
    catchUp,
    nextWeek: idx === 6 ? behind.slice(room) : [],
  };
}

/**
 * The daily plan as a session: warm-up on strengthening days, stretches, the
 * exercises, stretches again. By default the day's dose (Daniel, Oct 2: 15–20
 * min, sleeper only in its 3 breaks); `full` = the section 4 dose.
 */
export function dailyLayout(program: RehabProgram, plan: DailyPlan, full = false): SessionLayout {
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const stretch = program.exercises.filter((x) => x.block === 'stretch').map((x) => x.n);
  const band = plan.numbers.filter((n) => byN.get(n)!.block === 'band');
  const dumbbell = plan.numbers.filter((n) => byN.get(n)!.block === 'dumbbell');
  const groups: SessionLayout['groups'] = [{ block: 'stretch', numbers: stretch }];
  if (band.length) groups.push({ block: 'band', numbers: band });
  if (dumbbell.length) groups.push({ block: 'dumbbell', numbers: dumbbell });
  if (plan.numbers.length)
    groups.push({ block: 'stretch_end', numbers: program.daily.endStretches });
  return { key: plan.block, warmup: plan.numbers.length > 0, reduced: !full, groups };
}

/**
 * Today's daily plan around the main workout (Daniel, Oct 3). Strengthening
 * the rotator cuff before the gym tires the shoulder's stabilisers right when
 * back and chest work needs them, so on a training day only the stretches go
 * first (as a warm-up) and the block's strengthening comes after the workout,
 * unless the person picked "before". Program exercises already in today's
 * workout (a row, a curl) count for both and are not shown twice.
 */
export type CareDay = {
  /** The session to do first: the whole plan, or only the stretches. */
  first: DailyPlan;
  /** Strengthening for after the workout (empty when the day is not split). */
  after: number[];
  /** Program exercises left out because today's workout already has them. */
  inWorkout: number[];
};

export function careDay(
  program: RehabProgram,
  plan: DailyPlan,
  o: { trainingDay: boolean; timing?: StrengthTiming; workoutSlugs: Set<string> },
): CareDay {
  const slugOf = new Map(program.exercises.map((x) => [x.n, x.slug]));
  const inWorkout = plan.numbers.filter((n) => o.workoutSlugs.has(slugOf.get(n)!));
  const numbers = plan.numbers.filter((n) => !inWorkout.includes(n));
  const catchUp = plan.catchUp.filter((n) => numbers.includes(n));
  const whole = { ...plan, numbers, catchUp };
  if (!o.trainingDay || (o.timing ?? 'after') === 'before' || !numbers.length)
    return { first: whole, after: [], inWorkout };
  return {
    first: { ...plan, block: 'stretch', numbers: [], catchUp: [] },
    after: numbers,
    inWorkout,
  };
}

/**
 * The after-workout strengthening (Daniel, Oct 3: "Termine com o ombro"):
 * the block's exercises, then the end stretches as the cool-down. Right after
 * the workout the body is warm; at another time of day the short warm-up
 * comes first.
 */
export function afterLayout(
  program: RehabProgram,
  block: DailyBlock,
  numbers: number[],
  o: { full?: boolean; warm: boolean },
): SessionLayout {
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const band = numbers.filter((n) => byN.get(n)!.block === 'band');
  const dumbbell = numbers.filter((n) => byN.get(n)!.block === 'dumbbell');
  const groups: SessionLayout['groups'] = [];
  if (band.length) groups.push({ block: 'band', numbers: band });
  if (dumbbell.length) groups.push({ block: 'dumbbell', numbers: dumbbell });
  groups.push({ block: 'stretch_end', numbers: program.daily.endStretches });
  return { key: block, warmup: !o.warm, reduced: !o.full, groups };
}

/** Program sessions finished today, by session key. */
export function sessionsToday(workouts: WorkoutRecord[], programId: string, today: LocalDate) {
  return new Set(
    workouts
      .filter((w) => finished(w) && w.session.program?.id === programId && dayOf(w) === today)
      .map((w) => w.session.program!.session),
  );
}

/** A sleeper stretch break, outside the session (§6.2: 3 times a day, 2 min). */
export function sleeperLayout(program: RehabProgram): SessionLayout {
  const sleeper = program.exercises.find((x) => x.slug === 'sleeper_stretch');
  return {
    key: 'sleeper',
    warmup: false,
    groups: [{ block: 'stretch', numbers: sleeper ? [sleeper.n] : [] }],
  };
}

/** A daily session (any block, Sunday stretches) finished today. */
export function dailyDoneToday(workouts: WorkoutRecord[], programId: string, today: LocalDate) {
  return workouts.some(
    (w) =>
      finished(w) &&
      w.session.program?.id === programId &&
      w.session.program.session !== 'sleeper' &&
      dayOf(w) === today,
  );
}

/** Sleeper breaks finished today. */
export function sleeperBreaksToday(
  workouts: WorkoutRecord[],
  programId: string,
  today: LocalDate,
): number {
  return workouts.filter(
    (w) =>
      finished(w) &&
      w.session.program?.id === programId &&
      w.session.program.session === 'sleeper' &&
      dayOf(w) === today,
  ).length;
}

/** The days of this program week, Monday first. */
export const weekDays = (today: LocalDate) =>
  Array.from({ length: 7 }, (_, i) => addDays(programWeekStart(today), i));
