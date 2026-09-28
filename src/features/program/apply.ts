import { localDate, type LocalDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import type { GeneratorInput } from '../generator/types';
import type { WorkoutRecord } from '../workout/types';

import { blockWeek, DEFAULT_BLOCK_WEEKS, type BlockWeek } from './block';
import type { AppMode } from '../profile/age';

import { allowedPlan, planDayInput, type ReadyPlan } from './plans';

export type ProgramState = { planId: string | null; startedAt: LocalDate | null };

/** Regular workouts finished since the plan started: the day of the plan. */
export function planDayIndex(workouts: WorkoutRecord[], startedAt: LocalDate | null): number {
  return workouts.filter(
    (w) =>
      w.kind === 'regular' &&
      (w.status === 'done' || w.status === 'partial') &&
      (!startedAt || localDate(new Date(w.endedAt ?? w.createdAt)) >= startedAt),
  ).length;
}

/** Where the person is in their program: plan (if any), block week, deload. */
export function programStatus(
  program: ProgramState,
  workouts: WorkoutRecord[],
  today: LocalDate,
  mode?: AppMode,
  /** Planned days ahead of today, for a future day's preview (QA R4-08). */
  daysAhead = 0,
): { plan: ReadyPlan | undefined; block: BlockWeek; dayIndex: number } {
  // A plan for another age mode (a deep link, a birthday edit) is ignored (R4-04).
  const plan = allowedPlan(program.planId, mode);
  const firstWorkout = workouts
    .filter((w) => w.status === 'done' || w.status === 'partial')
    .map((w) => localDate(new Date(w.endedAt ?? w.createdAt)))
    .sort()[0];
  const start = program.startedAt ?? firstWorkout ?? today;
  return {
    plan,
    block: blockWeek(start, today, plan?.blockWeeks ?? DEFAULT_BLOCK_WEEKS),
    dayIndex: planDayIndex(workouts, program.startedAt) + daysAhead,
  };
}

/**
 * The generator input with the program applied (A2, A5): a ready-made plan's
 * day targets, and 40% less volume in the deload week. "My plan" keeps the
 * coach's targets. Safety input is never touched.
 */
export function withProgram(
  input: GeneratorInput,
  library: Exercise[],
  workouts: WorkoutRecord[],
  program: ProgramState,
  today: LocalDate,
  daysAhead = 0,
): GeneratorInput {
  const { plan, block, dayIndex } = programStatus(program, workouts, today, input.mode, daysAhead);
  const planned = plan ? planDayInput(input, plan, dayIndex, library) : input;
  return block.phase === 'deload' ? { ...planned, deload: true } : planned;
}
