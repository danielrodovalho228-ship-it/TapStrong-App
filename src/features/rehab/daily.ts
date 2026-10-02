import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';
import { addDays, daysBetween, localDate, weekStart, type LocalDate } from '@/lib/dates';

import type { DailyBlock, ProgramExercise, RehabProgram, SessionLayout } from './programs';

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
    const standard = daily.week[d];
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

/** The daily plan as a session: warm-up on strengthening days, stretches, the exercises, stretches again. */
export function dailyLayout(program: RehabProgram, plan: DailyPlan): SessionLayout {
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const stretch = program.exercises.filter((x) => x.block === 'stretch').map((x) => x.n);
  const band = plan.numbers.filter((n) => byN.get(n)!.block === 'band');
  const dumbbell = plan.numbers.filter((n) => byN.get(n)!.block === 'dumbbell');
  const groups: SessionLayout['groups'] = [{ block: 'stretch', numbers: stretch }];
  if (band.length) groups.push({ block: 'band', numbers: band });
  if (dumbbell.length) groups.push({ block: 'dumbbell', numbers: dumbbell });
  if (plan.numbers.length)
    groups.push({ block: 'stretch_end', numbers: program.daily.endStretches });
  return { key: plan.block, warmup: plan.numbers.length > 0, groups };
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
