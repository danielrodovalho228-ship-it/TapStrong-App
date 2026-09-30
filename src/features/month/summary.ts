import type { LocalDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import { visibleRecords } from '../library/performance';
import { muscleByKey } from '../muscles';
import type { AppMode } from '../profile/age';
import { strengthChangesBetween } from '../progress/checkin';
import type { StrengthRow } from '../progress/store';
import type { LoadUnit, WorkoutRecord } from '../workout/types';

import { dayOf, finished, previousBlock, workoutsIn, type BlockRange } from './cycle';

const KG_PER_LB = 0.45359237;
/** Below this, a muscle "got little training" (sets a week, month average). */
export const LOW_WEEKLY_SETS = 4;
/** Big movers the summary and the focus care about. */
export const LARGE_MUSCLES = [
  'chest',
  'upperBack',
  'lats',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
];

export type MonthRecord = { exerciseId: string; kind: 'heaviest'; value: number; unit: LoadUnit };

/** A closed block, small enough to keep and sync as JSON (Phase 26, G). */
export type MonthSummary = {
  blockNo: number;
  weeks: number;
  from: LocalDate;
  to: LocalDate;
  workouts: number;
  trainedDays: LocalDate[];
  minutes: number;
  /** Working sets per muscle (parent key) in the block, and in the one before. */
  sets: Record<string, number>;
  prevSets: Record<string, number>;
  /** Week 1 vs the last week; empty for minors (habits, not numbers). */
  strength: StrengthRow[];
  /** New heaviest loads this block, only where the age mode shows records. */
  records: MonthRecord[];
  /** "Back was your highlight: +3 sets/week" — the growth vs last month, or the most trained. */
  strong: { muscle: string; perWeek: number; kind: 'growth' | 'most' } | null;
  /** "Hamstrings got little training." */
  weak: { muscle: string } | null;
};

const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;

/** Working sets per parent muscle (main work and finishers; warm-ups and cool-downs don't count). */
export function setsByMuscle(
  workouts: WorkoutRecord[],
  library: Exercise[],
): Record<string, number> {
  const byId = new Map(library.map((e) => [e.id, e]));
  const out: Record<string, number> = {};
  for (const w of workouts) {
    const work = new Set(
      w.session.items.filter((i) => i.role === 'main' || i.role === 'finisher').map((i) => i.id),
    );
    for (const l of w.logs) {
      if (!work.has(l.itemId)) continue;
      const e = byId.get(l.exerciseId);
      if (!e) continue;
      const parents = new Set(
        e.muscles.filter((m) => m.role === 'primary').map((m) => parentOf(m.muscleKey)),
      );
      for (const p of parents) out[p] = (out[p] ?? 0) + 1;
    }
  }
  return out;
}

const minutesOf = (w: WorkoutRecord) =>
  w.startedAt && w.endedAt
    ? Math.max(0, Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60000))
    : (w.session.estimatedMinutes ?? w.session.minutes ?? 0);

const kg = (load: number, unit: LoadUnit | undefined) => (unit === 'lb' ? load * KG_PER_LB : load);

/** Heaviest loads in the block that beat everything before it. */
export function monthRecords(
  workouts: WorkoutRecord[],
  block: Pick<BlockRange, 'from' | 'to'>,
  mode: AppMode,
): MonthRecord[] {
  if (!visibleRecords(mode).includes('heaviest')) return [];
  const before = new Map<string, number>();
  const inside = new Map<string, { kg: number; value: number; unit: LoadUnit }>();
  for (const w of workouts) {
    if (!finished(w)) continue;
    const d = dayOf(w);
    if (d >= block.to) continue;
    for (const l of w.logs) {
      if (l.load == null || l.load <= 0) continue;
      const k = kg(l.load, l.unit);
      if (d < block.from) before.set(l.exerciseId, Math.max(before.get(l.exerciseId) ?? 0, k));
      else if (k > (inside.get(l.exerciseId)?.kg ?? 0))
        inside.set(l.exerciseId, { kg: k, value: l.load, unit: l.unit ?? 'kg' });
    }
  }
  return [...inside]
    .filter(([id, best]) => before.has(id) && best.kg > before.get(id)!)
    .map(([exerciseId, best]) => ({
      exerciseId,
      kind: 'heaviest' as const,
      value: best.value,
      unit: best.unit,
    }))
    .sort((a, b) => (a.exerciseId < b.exerciseId ? -1 : 1));
}

/** The block's summary: counts, sets per muscle, strength, records, highlights. */
export function buildMonthSummary(input: {
  workouts: WorkoutRecord[];
  library: Exercise[];
  block: BlockRange;
  mode: AppMode;
  /** The person's own muscle goals (parent keys): the "to improve" line looks there first. */
  goals: string[];
}): MonthSummary {
  const { block, mode } = input;
  const inBlock = workoutsIn(input.workouts, block);
  const prev = previousBlock(block);
  const sets = setsByMuscle(inBlock, input.library);
  const prevSets = prev ? setsByMuscle(workoutsIn(input.workouts, prev), input.library) : {};
  const minor = mode === 'child' || mode === 'teen';
  const start = Date.parse(`${block.from}T00:00:00`);
  const end = Date.parse(`${block.to}T00:00:00`);
  const perWeek = (n: number) => n / block.weeks;

  const growth = Object.keys(sets)
    .map((m) => ({ m, d: Math.round(perWeek((sets[m] ?? 0) - (prevSets[m] ?? 0))) }))
    .filter((x) => x.d >= 1)
    .sort((a, b) => b.d - a.d || (a.m < b.m ? -1 : 1))[0];
  const most = Object.entries(sets).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  const strong =
    prev && growth
      ? { muscle: growth.m, perWeek: growth.d, kind: 'growth' as const }
      : most
        ? { muscle: most[0], perWeek: Math.round(perWeek(most[1])), kind: 'most' as const }
        : null;

  const candidates = [...new Set([...input.goals.map(parentOf), ...LARGE_MUSCLES])];
  const weakest = candidates
    .map((m) => ({ m, w: perWeek(sets[m] ?? 0) }))
    .filter((x) => x.w < LOW_WEEKLY_SETS && x.m !== strong?.muscle)
    .sort(
      (a, b) =>
        // The person's own goals first, then the least trained.
        Number(input.goals.map(parentOf).includes(b.m)) -
          Number(input.goals.map(parentOf).includes(a.m)) ||
        a.w - b.w ||
        (a.m < b.m ? -1 : 1),
    )[0];

  return {
    blockNo: block.blockNo,
    weeks: block.weeks,
    from: block.from,
    to: block.to,
    workouts: inBlock.length,
    trainedDays: [...new Set(inBlock.map(dayOf))].sort(),
    minutes: inBlock.reduce((n, w) => n + minutesOf(w), 0),
    sets,
    prevSets,
    strength: minor ? [] : strengthChangesBetween(inBlock, start, end - 1),
    records: monthRecords(input.workouts, block, mode),
    strong,
    weak: weakest ? { muscle: weakest.m } : null,
  };
}

/** Sets a week (month average) per muscle, for the focus. */
export const weeklyAverage = (summary: Pick<MonthSummary, 'sets' | 'weeks'>, muscle: string) =>
  (summary.sets[muscle] ?? 0) / summary.weeks;
