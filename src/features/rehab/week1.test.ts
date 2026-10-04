import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { addDays } from '@/lib/dates';

import {
  afterLayout,
  dailyLayout,
  dailyPlan,
  dayKind,
  fitMinutes,
  MAX_CATCH_UP,
  WEEK1_MAX_MINUTES,
} from './daily';
import { buildProgramSession, SHOULDER_PROGRAM as P, type AffectedSide } from './programs';

/**
 * Phase 32 B3–B5 (Daniel's Android test, Oct 4): "Shoulder today · Stretches
 * only · about 73 min" with 7 exercises "left behind" on the first day.
 */
const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const slugOf = new Map(LIBRARY.map((e) => [e.id, e.slug]));
const MONDAY = '2026-10-05';
const DAYS = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));
const build = (
  layout: Parameters<typeof buildProgramSession>[1],
  affected: AffectedSide = 'right',
) => buildProgramSession(P, layout, { library: LIBRARY, affected, week: 1 });

describe('no backlog on day 1 (B4)', () => {
  it.each(DAYS)('starting on %s: nothing is "left behind" that week', (start) => {
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, d);
      if (day >= addDays(MONDAY, 7)) break;
      const plan = dailyPlan(P, day, {}, undefined, undefined, start);
      expect([day, plan.catchUp, plan.nextWeek]).toEqual([day, [], []]);
    }
  });

  it('the 73-minute day (started on a Sunday): stretches only, a few minutes', () => {
    const sunday = addDays(MONDAY, 6);
    const plan = dailyPlan(P, sunday, {}, undefined, undefined, sunday);
    expect(plan).toMatchObject({ block: 'stretch', numbers: [], catchUp: [] });
    expect(build(dailyLayout(P, plan)).minutes).toBeLessThanOrEqual(10);
    expect(dayKind(P, plan.numbers)).toBe('mobility');
  });
});

describe('catch-up: never more than 1 extra exercise a session (B4)', () => {
  it('after missed days, any day of the week', () => {
    for (const day of DAYS) {
      const plan = dailyPlan(P, day, {});
      expect(plan.catchUp.length).toBeLessThanOrEqual(MAX_CATCH_UP);
    }
    // Everything missed by Sunday: still one.
    expect(dailyPlan(P, DAYS[6], {}).catchUp).toHaveLength(1);
  });
});

describe('week 1: 25 min at most (B4)', () => {
  // The physio's full dose starts in week 2 (useRehabRun).
  it.each(['right', 'both'] as const)("every day, the day's dose, %s side", (side) => {
    for (const day of DAYS)
      for (const full of [false]) {
        const plan = fitMinutes(P, dailyPlan(P, day, {}), {
          library: LIBRARY,
          affected: side,
          full,
          max: WEEK1_MAX_MINUTES,
        });
        const s = build(dailyLayout(P, plan, full), side);
        expect([day, full, s.minutes <= WEEK1_MAX_MINUTES]).toEqual([day, full, true]);
        // Shortened, never removed: a strength day keeps its warm-up and cool-down.
        if (plan.numbers.length) {
          expect(s.items[0].role).toBe('warmup');
          expect(s.items.at(-1)!.role).toBe('cooldown');
        }
      }
  });
});

describe('each exercise once per session (B5)', () => {
  it('sessions A, B, C, every daily day, the after-workout part', () => {
    const layouts = [
      ...(['A', 'B', 'C'] as const),
      ...DAYS.flatMap((day) => {
        const plan = dailyPlan(P, day, {});
        return [false, true].flatMap((full) => [
          dailyLayout(P, plan, full),
          ...(plan.block === 'stretch'
            ? []
            : [afterLayout(P, plan.block, plan.numbers, { full, warm: false })]),
        ]);
      }),
    ];
    for (const layout of layouts) {
      const slugs = build(layout).items.map((i) => slugOf.get(i.exerciseId));
      expect(slugs.filter((s, i) => slugs.indexOf(s) !== i)).toEqual([]);
    }
  });
});

describe('the warm-up is light shoulder mobility, 2–3 min (B3)', () => {
  it('pendulum, shoulder rolls and shrugs; no brisk walk', () => {
    for (const key of ['B', 'C'] as const) {
      const s = build(key);
      const warm = s.items.filter((i) => i.role === 'warmup');
      expect(warm.map((i) => slugOf.get(i.exerciseId))).toEqual([
        'pendulum_swing',
        'wu_seated_shoulder_rolls',
        'su_seated_shrug_hold',
      ]);
      const seconds = warm.reduce((n, i) => n + i.estSeconds, 0);
      expect(seconds).toBeGreaterThanOrEqual(120);
      expect(seconds).toBeLessThanOrEqual(180);
    }
  });
});

describe('the card title says what the day is (B4)', () => {
  it('mobility, + band, + light dumbbell', () => {
    expect(dayKind(P, [])).toBe('mobility');
    expect(dayKind(P, [6, 7])).toBe('band');
    expect(dayKind(P, [12, 13])).toBe('dumbbell');
    expect(dayKind(P, P.daily.blocks.standing)).toBe('bandDumbbell');
  });
});
