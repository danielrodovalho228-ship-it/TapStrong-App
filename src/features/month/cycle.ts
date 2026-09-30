import { addDays, daysBetween, localDate, type LocalDate } from '@/lib/dates';

import type { WorkoutRecord } from '../workout/types';

/**
 * "Month closed" (Daniel, Phase 26): at the end of each block (after its
 * lighter week) the app sums up the block and brings the next one ready.
 * A block is 4 weeks without a plan (= "1 month"), or the plan's 4–6 weeks,
 * counted from the plan's start (or the first finished workout).
 */
export const MIN_WORKOUTS = 4;
/** A closed-but-skipped summary stays on Home for a week. */
export const CARD_DAYS = 7;
/** "Undo" brings back the previous month for a week. */
export const UNDO_DAYS = 7;

export type BlockRange = {
  /** 0 = the first block since the anchor. */
  blockNo: number;
  weeks: number;
  from: LocalDate;
  /** First day after the block. */
  to: LocalDate;
};

const blockWeeks = (weeks: number) => Math.max(4, Math.min(6, Math.round(weeks)));

/** The most recent block that has fully ended by `today`, or null. */
export function lastClosedBlock(
  anchor: LocalDate,
  today: LocalDate,
  weeks: number,
): BlockRange | null {
  const of = blockWeeks(weeks);
  const days = daysBetween(anchor, today);
  const blockNo = Math.floor(days / (of * 7)) - 1;
  if (blockNo < 0) return null;
  const from = addDays(anchor, blockNo * of * 7);
  return { blockNo, weeks: of, from, to: addDays(from, of * 7) };
}

/** The first day after the block that contains `today` (when its summary opens). */
export function currentBlockEnd(anchor: LocalDate, today: LocalDate, weeks: number): LocalDate {
  const of = blockWeeks(weeks);
  const n = Math.floor(Math.max(0, daysBetween(anchor, today)) / (of * 7));
  return addDays(anchor, (n + 1) * of * 7);
}

/** The block before `block` (for "vs last month"), or null. */
export function previousBlock(block: BlockRange): BlockRange | null {
  if (block.blockNo === 0) return null;
  const from = addDays(block.from, -block.weeks * 7);
  return { blockNo: block.blockNo - 1, weeks: block.weeks, from, to: block.from };
}

export const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';

export const dayOf = (w: WorkoutRecord) => localDate(new Date(w.endedAt ?? w.createdAt));

/** Finished workouts inside a block. */
export function workoutsIn(workouts: WorkoutRecord[], block: Pick<BlockRange, 'from' | 'to'>) {
  return workouts.filter((w) => {
    if (!finished(w)) return false;
    const d = dayOf(w);
    return d >= block.from && d < block.to;
  });
}

export type MonthDue =
  | { kind: 'summary'; block: BlockRange }
  /** Fewer than 4 workouts: a light "Shall we pick it up again?" card, no summary. */
  | { kind: 'resume'; block: BlockRange }
  | null;

/**
 * What to show for the last closed block: nothing when it was already
 * reviewed (once per block), nothing for a profile without workouts, a
 * summary with 4+ workouts in the block, else the light "resume" card.
 */
export function monthDue(input: {
  anchor: LocalDate;
  today: LocalDate;
  weeks: number;
  workouts: WorkoutRecord[];
  /** The last block already shown (summary or resume card), by its start day. */
  reviewedFrom: LocalDate | null;
}): MonthDue {
  if (!input.workouts.some(finished)) return null;
  const block = lastClosedBlock(input.anchor, input.today, input.weeks);
  if (!block) return null;
  if (input.reviewedFrom && input.reviewedFrom >= block.from) return null;
  return {
    kind: workoutsIn(input.workouts, block).length >= MIN_WORKOUTS ? 'summary' : 'resume',
    block,
  };
}

/** Whether an ISO time is still before `until` (card, undo). */
export const stillBefore = (until: string | null | undefined, now: Date) =>
  !!until && now.getTime() < Date.parse(until);

export const daysFrom = (now: Date, days: number) =>
  new Date(now.getTime() + days * 86_400_000).toISOString();
