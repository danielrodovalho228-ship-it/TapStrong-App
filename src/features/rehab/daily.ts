import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';
import { addDays, daysBetween, localDate, weekStart, type LocalDate } from '@/lib/dates';

import {
  buildProgramSession,
  coolDownStretches,
  type AffectedSide,
  type DailyBlock,
  type ProgramExercise,
  type RehabProgram,
  type SessionLayout,
  type StrengthTiming,
} from './programs';

/** Missed exercises added to one session, at most (Phase 32 B4). */
export const MAX_CATCH_UP = 1;
/** The longest daily session in week 1, minutes (Phase 32 B4: 20–25 min). */
export const WEEK1_MAX_MINUTES = 25;

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
 * 2. One exercise of the other block that can no longer reach 3 in the days
 *    left moves to today (Phase 32 B4: never more than 1 extra a session).
 * 3. What does not fit goes to next week, never a double dose.
 * 4. Nothing is "left behind" in the week the program starts: it is the
 *    gentle start (Phase 32 B4: no backlog on day 1).
 */
export function dailyPlan(
  program: RehabProgram,
  today: LocalDate,
  counts: Record<string, number>,
  /** Picked by the person for today (§6.2: "o usuário pode trocar o dia"). */
  pick?: DailyBlock,
  /** The standard week to follow (`careWeek`); the program's own by default. */
  week: (DailyBlock | 'stretch')[] = program.daily.week,
  /** The program's first day: no catch-up in its first week. */
  startedAt?: LocalDate,
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
  const firstWeek = !!startedAt && startedAt >= programWeekStart(today);
  const behind = firstWeek
    ? []
    : other.flatMap((b) => daily.blocks[b].filter((n) => need(n) > slots[b]));
  const room = Math.min(MAX_CATCH_UP, Math.max(0, daily.cap - stretches - numbers.length));
  const catchUp = behind.slice(0, room);
  return {
    block: block !== 'stretch' && !numbers.length && !catchUp.length ? 'stretch' : block,
    numbers: [...numbers, ...catchUp],
    catchUp,
    nextWeek: idx === 6 ? behind.slice(room) : [],
  };
}

/**
 * The daily plan as a session. A strengthening day: the light mobility
 * warm-up, the exercises, then the stretches as the cool-down; a stretch day:
 * the stretches alone. Each exercise once (Phase 32 B5). By default the day's
 * dose (Daniel, Oct 2: sleeper only in its 3 breaks); `full` = section 4.
 */
export function dailyLayout(program: RehabProgram, plan: DailyPlan, full = false): SessionLayout {
  if (!plan.numbers.length) {
    const stretch = program.exercises.filter((x) => x.block === 'stretch').map((x) => x.n);
    return {
      key: plan.block,
      warmup: false,
      reduced: !full,
      groups: [{ block: 'stretch', numbers: stretch }],
    };
  }
  return {
    key: plan.block,
    warmup: true,
    reduced: !full,
    groups: [...strengthGroups(program, plan.numbers), coolDown(program)],
  };
}

const strengthGroups = (program: RehabProgram, numbers: number[]): SessionLayout['groups'] => {
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const groups: SessionLayout['groups'] = [];
  for (const block of ['band', 'dumbbell'] as const) {
    const of = numbers.filter((n) => byN.get(n)!.block === block);
    if (of.length) groups.push({ block, numbers: of });
  }
  return groups;
};
const coolDown = (program: RehabProgram): SessionLayout['groups'][number] => ({
  block: 'stretch_end',
  numbers: coolDownStretches(program),
});

/**
 * Week 1 stays short (Phase 32 B4: 20–25 min): strengthening exercises come
 * off the end of the day (the catch-up first) until the session fits.
 */
export function fitMinutes(
  program: RehabProgram,
  plan: DailyPlan,
  o: {
    library: Exercise[];
    affected: AffectedSide;
    full?: boolean;
    max: number;
    behindOk?: boolean;
  },
): DailyPlan {
  let numbers = plan.numbers;
  const minutes = (ns: number[]) =>
    buildProgramSession(program, dailyLayout(program, { ...plan, numbers: ns }, o.full), {
      library: o.library,
      affected: o.affected,
      week: 1,
      behindOk: o.behindOk,
    }).minutes;
  while (numbers.length && minutes(numbers) > o.max) numbers = numbers.slice(0, -1);
  if (numbers.length === plan.numbers.length) return plan;
  const catchUp = plan.catchUp.filter((n) => numbers.includes(n));
  return {
    ...plan,
    block: numbers.length ? plan.block : 'stretch',
    numbers,
    catchUp,
    nextWeek: plan.nextWeek,
  };
}

/** What a day's shoulder work really is, for its title (Phase 32 B4). */
export type DayKind = 'mobility' | 'band' | 'dumbbell' | 'bandDumbbell';
export function dayKind(program: RehabProgram, numbers: number[]): DayKind {
  const blocks = new Set(
    numbers.map((n) => program.exercises.find((x) => x.n === n)?.block).filter(Boolean),
  );
  if (blocks.has('band') && blocks.has('dumbbell')) return 'bandDumbbell';
  if (blocks.has('band')) return 'band';
  if (blocks.has('dumbbell')) return 'dumbbell';
  return 'mobility';
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
  return {
    key: block,
    warmup: !o.warm,
    reduced: !o.full,
    groups: [...strengthGroups(program, numbers), coolDown(program)],
  };
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
