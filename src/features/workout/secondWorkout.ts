import { canStartWorkout, currentPlan } from '../billing/rules';
import type { Entitlement } from '../billing/store';
import type { AppMode } from '../profile/age';
import { deviceWeekStart, localDate } from '@/lib/dates';

import { sharpStopAreasToday } from './safety';
import type { WorkoutRecord } from './types';

/**
 * The day's second workout (Daniel, Phase 19; closed on every path in QA R8
 * P2): once today's workout is done, or after a sharp pain stop, only
 * mobility, balance or rest. An adult may still choose an extra workout,
 * after a warning, when the plan has a workout left.
 */
export type TodayState = {
  stoppedToday: boolean;
  doneToday: boolean;
  /** Only mobility, balance or rest today. */
  easyDay: boolean;
  /** An adult may start an extra full workout (after the warning). */
  extraAllowed: boolean;
};

export function todayState(o: {
  workouts: WorkoutRecord[];
  now: Date;
  mode: AppMode;
  entitlement: Entitlement;
}): TodayState {
  const today = localDate(o.now);
  const sameDay = (w: WorkoutRecord) =>
    localDate(new Date(w.logs.at(-1)?.loggedAt ?? w.startedAt ?? w.createdAt)) === today;
  const active = o.workouts.some((w) => w.status === 'active' && sameDay(w));
  const stoppedToday = !active && sharpStopAreasToday(o.workouts, today).length > 0;
  const doneToday =
    !active &&
    !stoppedToday &&
    o.workouts.some(
      (w) => (w.status === 'done' || w.status === 'partial') && w.kind === 'regular' && sameDay(w),
    );
  // A free plan with its weekly workouts used has no extra to offer (QA R8 P2).
  const planLeft =
    currentPlan(o.entitlement, o.now) !== 'free' ||
    canStartWorkout('free', o.workouts, o.now, deviceWeekStart()).allowed;
  return {
    stoppedToday,
    doneToday,
    easyDay: stoppedToday || doneToday,
    extraAllowed: doneToday && o.mode === 'adult' && planLeft,
  };
}

/** A full workout may be built now: no easy day, or an adult's extra. */
export const fullWorkoutAllowed = (s: TodayState) => !s.easyDay || s.extraAllowed;
