import type { Condition, PainArea, Position } from '../onboarding/options';
import type { AppMode } from '../profile/age';
import type { RepairPlan, RepairResult } from '../progress/store';

export type RepairTest = {
  key: string;
  kind: 'reps' | 'hold' | 'sides_hold' | 'sides_pass';
  seconds?: number;
  positions: Position[];
  contraindications: (PainArea | Condition)[];
  good?: Record<AppMode, number>;
  focus: { goal: 'strengthen' | 'balance' | 'mobility'; muscles: string[] };
  /** Joint movements the test needs (reviewed with the catalog, SPEC §8). */
  joints?: [string, string, string][];
};

/**
 * The Repair check tests. They map results to muscles, so like exercises they
 * are drafts until the certified reviewer signs them off: development builds
 * only (the require sits inside `if (__DEV__)`, release bundles drop it).
 */
export function repairTests(): RepairTest[] {
  if (__DEV__) {
    const data = require('../../../supabase/seed/repair_tests.json') as { tests: RepairTest[] };
    return data.tests;
  }
  return [];
}

/** Tests this person can do safely (position ability, pain areas, conditions). */
export function testsFor(
  tests: RepairTest[],
  position: Position,
  risks: readonly string[],
): RepairTest[] {
  return tests.filter(
    (t) => t.positions.includes(position) && !t.contraindications.some((c) => risks.includes(c)),
  );
}

export type Grade = 'good' | 'uneven' | 'low' | 'limited' | 'todo';

/** Uneven: the sides differ by more than 25% (and at least 5 s). */
const uneven = (a: number, b: number) =>
  Math.abs(a - b) >= 5 && Math.abs(a - b) / Math.max(a, b, 1) > 0.25;

export function grade(test: RepairTest, result: RepairResult | undefined, mode: AppMode): Grade {
  if (!result) return 'todo';
  const target = test.good?.[mode] ?? 0;
  switch (test.kind) {
    case 'reps':
    case 'hold':
      return (result.value ?? 0) >= target ? 'good' : 'low';
    case 'sides_hold': {
      const l = result.left ?? 0;
      const r = result.right ?? 0;
      if (uneven(l, r)) return 'uneven';
      return Math.min(l, r) >= target ? 'good' : 'low';
    }
    case 'sides_pass':
      return result.passLeft && result.passRight ? 'good' : 'limited';
  }
}

export type Finding = {
  testKey: string;
  grade: Exclude<Grade, 'good' | 'todo'>;
  /** For uneven results, the weaker side. */
  side?: 'left' | 'right';
};

export function findings(tests: RepairTest[], results: RepairResult[], mode: AppMode): Finding[] {
  const out: Finding[] = [];
  for (const t of tests) {
    const r = results.find((x) => x.testKey === t.key);
    const g = grade(t, r, mode);
    if (g === 'good' || g === 'todo') continue;
    let side: Finding['side'];
    if (t.kind === 'sides_hold' && r) side = (r.left ?? 0) < (r.right ?? 0) ? 'left' : 'right';
    if (t.kind === 'sides_pass' && r && r.passLeft !== r.passRight)
      side = r.passLeft ? 'right' : 'left';
    out.push({ testKey: t.key, grade: g, side });
  }
  return out;
}

export const PLAN_WEEKS = 6;
export const PLAN_SESSIONS_PER_WEEK = 2;
export const PLAN_MINUTES = 15;
const DAY = 86_400_000;

/** The 6-week Repair plan: the weak areas' muscles, with the test's goal. */
export function buildRepairPlan(
  tests: RepairTest[],
  found: Finding[],
  now: Date,
): RepairPlan | null {
  const focus: RepairPlan['focus'] = [];
  for (const f of found) {
    const t = tests.find((x) => x.key === f.testKey);
    if (!t) continue;
    for (const muscleKey of t.focus.muscles) {
      if (!focus.some((x) => x.muscleKey === muscleKey))
        focus.push({ muscleKey, goal: t.focus.goal });
    }
  }
  if (!focus.length) return null;
  return {
    createdAt: now.toISOString(),
    weeks: PLAN_WEEKS,
    sessionsPerWeek: PLAN_SESSIONS_PER_WEEK,
    focus: focus.slice(0, 4),
    retestAt: new Date(now.getTime() + PLAN_WEEKS * 7 * DAY).toISOString(),
  };
}
