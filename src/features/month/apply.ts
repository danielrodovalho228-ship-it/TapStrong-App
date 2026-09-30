import { localDate } from '@/lib/dates';
import { uuid } from '@/lib/uuid';

import type { Exercise } from '../exercises/types';
import type { GeneratorInput } from '../generator/types';
import { muscleByKey } from '../muscles';
import type { AppMode } from '../profile/age';
import type { WorkoutRecord } from '../workout/types';

import { candidatesFor, daysSinceTrained, recentMoves, renewItems } from './analyze';
import { monthDue, type MonthDue } from './cycle';
import { suggestFocus } from './focus';
import { planRenewal, repeatPlan } from './renew';
import { monthInputs, useMonthStore, type MonthData, type MonthEntry } from './store';
import { buildMonthSummary } from './summary';

const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;

/**
 * The generator input with this month applied (Phase 26): the month's moves
 * preferred, swapped-out ones left out, sharp-pain moves banned, and the
 * focus muscles targeted (added to the person's goals, never replacing
 * them) with one more set each time. Every safety filter and weekly cap
 * still applies inside the generator.
 */
export function withMonth(
  input: GeneratorInput,
  data: Pick<MonthData, 'plan' | 'banned'>,
): GeneratorInput {
  const m = monthInputs(data);
  const have = new Set(input.muscleGoals.map((g) => parentOf(g.muscleKey)));
  const focusGoals = m.focusMuscles
    .filter((muscle) => !have.has(muscle))
    .map((muscleKey) => ({ muscleKey, goal: input.muscleGoals[0]?.goal ?? ('grow' as const) }));
  return {
    ...input,
    muscleGoals: [...focusGoals, ...input.muscleGoals],
    preferred: m.preferred,
    avoid: m.avoid,
    banned: [...new Set([...(input.banned ?? []), ...m.banned])],
    focusMuscles: m.focusMuscles,
  };
}

/**
 * Closes the last block if it is due and not reviewed yet: a summary and the
 * next-month offer (4+ workouts), or the light "resume" card. Returns what
 * happened so Home can show the full screen once.
 */
export function closeMonthIfDue(input: {
  now: Date;
  anchor: string;
  weeks: number;
  workouts: WorkoutRecord[];
  library: Exercise[];
  generator: GeneratorInput;
  mode: AppMode;
  goals: string[];
  favourites: string[];
  locked?: string[];
  uneven?: string[];
}): MonthDue {
  const store = useMonthStore.getState();
  const today = localDate(input.now);
  const due = monthDue({
    anchor: input.anchor,
    today,
    weeks: input.weeks,
    workouts: input.workouts,
    reviewedFrom: store.reviewedFrom,
  });
  if (!due) return null;
  if (due.kind === 'resume') {
    store.markResume(due.block.from, input.now);
    return due;
  }
  const summary = buildMonthSummary({
    workouts: input.workouts,
    library: input.library,
    block: due.block,
    mode: input.mode,
    goals: input.goals,
  });
  const generator = {
    ...input.generator,
    banned: [...(input.generator.banned ?? []), ...store.banned],
  };
  const items = renewItems({
    workouts: input.workouts,
    block: due.block,
    library: input.library,
    generator,
  });
  const recommended = planRenewal({
    items,
    favourites: input.favourites,
    locked: input.locked ?? [],
    recent: recentMoves(input.workouts, due.block),
    mode: input.mode,
    candidates: candidatesFor(generator, input.library),
  });
  const weekly = Object.fromEntries(
    Object.entries(summary.sets).map(([m, n]) => [m, n / summary.weeks]),
  );
  const focus = suggestFocus({
    weekly,
    goals: input.goals,
    daysSince: daysSinceTrained(input.workouts, input.library, today),
    uneven: input.uneven,
  });
  const entry: MonthEntry = {
    id: uuid(),
    blockNo: due.block.blockNo,
    from: due.block.from,
    to: due.block.to,
    summary,
    choice: null,
    changes: [],
    focus,
    undoUntil: null,
    createdAt: input.now.toISOString(),
  };
  store.openMonth(entry, { recommended, repeat: repeatPlan(items), focus }, input.now);
  return due;
}

/**
 * Recomputes the "Continue" offer with moves the person locked in "See /
 * adjust" (locked = kept). Everything else stays as offered.
 */
export function relockOffer(input: {
  workouts: WorkoutRecord[];
  library: Exercise[];
  generator: GeneratorInput;
  mode: AppMode;
  favourites: string[];
  locked: string[];
}) {
  const s = useMonthStore.getState();
  const entry = s.history.find((h) => h.id === s.offer?.entryId);
  if (!s.offer || !entry) return;
  const block = {
    blockNo: entry.blockNo,
    weeks: entry.summary.weeks,
    from: entry.from,
    to: entry.to,
  };
  const generator = {
    ...input.generator,
    banned: [...(input.generator.banned ?? []), ...s.banned],
  };
  const items = renewItems({ workouts: input.workouts, block, library: input.library, generator });
  const recommended = planRenewal({
    items,
    favourites: input.favourites,
    locked: input.locked,
    recent: recentMoves(input.workouts, block),
    mode: input.mode,
    candidates: candidatesFor(generator, input.library),
  });
  useMonthStore.setState({ offer: { ...s.offer, recommended } });
}

/** Starting a workout without choosing applies the recommendation (Phase 26, decision 3). */
export function autoChooseIfPending(now: Date): boolean {
  const s = useMonthStore.getState();
  if (!s.offer) return false;
  s.choose('auto', now);
  return true;
}
