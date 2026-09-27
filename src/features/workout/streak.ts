import { addDays, daysBetween, weekStart, type LocalDate, type WeekStartDay } from '@/lib/dates';

/**
 * Streak rules — SPEC §8 "Body colors & streak":
 * - an active day is any logged workout or mobility session;
 * - 1 rest day per calendar week does not break it; the week starts on the
 *   day the phone's calendar says (Sunday when unknown);
 * - every 7 active days earn 1 streak freeze, with at most 2 banked;
 * - a freeze covers a missed day once the week's rest day is used.
 * `current` counts active days; rest and frozen days keep it alive.
 */
export type StreakState = {
  current: number;
  best: number;
  freezes: number;
  lastActive: LocalDate | null;
  /** Missed days covered by the weekly rest day (recent weeks only). */
  restDays: LocalDate[];
};

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export const initialStreak = (): StreakState => ({
  current: 0,
  best: 0,
  freezes: 0,
  lastActive: null,
  restDays: [],
});

type Covered = { restDays: LocalDate[]; freezes: number } | null;

/** Covers the missed days strictly between `from` and `to`; null = broken. */
function coverGap(
  state: StreakState,
  from: LocalDate,
  to: LocalDate,
  startsOn: WeekStartDay,
): Covered {
  let restDays = [...state.restDays];
  let freezes = state.freezes;
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) {
    const week = weekStart(d, startsOn);
    if (!restDays.some((r) => weekStart(r, startsOn) === week)) restDays.push(d);
    else if (freezes > 0) freezes--;
    else return null;
  }
  // Keep only the last few weeks; older rest days no longer matter.
  restDays = restDays.filter((r) => daysBetween(r, to) <= 14);
  return { restDays, freezes };
}

/**
 * After a break, a missed day in this week still used the week's rest day,
 * so it cannot cover another gap later that week (QA round 1).
 */
function restUsedByBreak(from: LocalDate, to: LocalDate, startsOn: WeekStartDay): LocalDate[] {
  const week = weekStart(to, startsOn);
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) {
    if (weekStart(d, startsOn) === week) return [d];
  }
  return [];
}

/** The streak as it stands today, without changing anything. */
export function streakToday(
  state: StreakState,
  today: LocalDate,
  startsOn: WeekStartDay = 0,
): number {
  if (!state.lastActive) return 0;
  if (state.lastActive >= today) return state.current;
  return coverGap(state, state.lastActive, today, startsOn) ? state.current : 0;
}

/** Records an active day. Returns the new state and whether a milestone was hit. */
export function recordActiveDay(
  state: StreakState,
  today: LocalDate,
  startsOn: WeekStartDay = 0,
): { state: StreakState; milestone: boolean } {
  if (state.lastActive && state.lastActive >= today) return { state, milestone: false };
  const covered = state.lastActive ? coverGap(state, state.lastActive, today, startsOn) : null;
  const current = covered ? state.current + 1 : 1;
  const milestone = current % FREEZE_EVERY === 0;
  const freezes = covered?.freezes ?? state.freezes;
  return {
    state: {
      current,
      best: Math.max(state.best, current),
      freezes: milestone ? Math.min(MAX_FREEZES, freezes + 1) : freezes,
      lastActive: today,
      restDays:
        covered?.restDays ??
        (state.lastActive ? restUsedByBreak(state.lastActive, today, startsOn) : []),
    },
    milestone,
  };
}
