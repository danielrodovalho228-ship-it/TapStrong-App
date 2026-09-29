/**
 * Improvements v1, A4 — suggested load and progression, deterministic.
 */
import seed from '../../../supabase/seed/exercises.json';
import { devLibrary, fromSeed, type SeedExercise } from '../exercises/library';

import { isLowerBody, loadAdvice, loadText, type Session } from './loads';

const LIBRARY = devLibrary();
const ex = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;
const bench = ex('barbell_bench_press');
const squat = LIBRARY.find((e) => e.loaded && e.pattern === 'squat')!;
const pushUp = ex('push_up');

const s = (reps: number[], load?: number, rpe?: number, unit: 'lb' | 'kg' = 'lb'): Session => ({
  endedAt: '2026-09-20T10:00:00Z',
  logs: reps.map((r, i) => ({
    itemId: 'm',
    exerciseId: 'x',
    setNo: i + 1,
    reps: r,
    ...(load != null ? { load, unit } : {}),
    ...(rpe != null ? { rpe } : {}),
    loggedAt: '2026-09-20T10:00:00Z',
  })),
});
const advice = (
  sessions: Session[],
  exercise = bench,
  extra: Partial<Parameters<typeof loadAdvice>[0]> = {},
) => loadAdvice({ sessions, range: [10, 12], exercise, unit: 'lb', mode: 'adult', ...extra });

describe('suggested load (A4)', () => {
  it('first time with a loaded move: ask for a weight with 2 reps in reserve', () => {
    expect(advice([])).toEqual({ kind: 'first' });
  });

  it('top of the range in the last 2 sessions with RPE ≤ 8: +5 lb upper, +10 lb lower', () => {
    const top = [s([12, 12, 12], 100, 8), s([12, 12, 12], 100, 7)];
    expect(advice(top)).toEqual({ kind: 'load', load: 105, unit: 'lb', change: 'up' });
    expect(isLowerBody(squat)).toBe(true);
    expect(advice(top, squat)).toEqual({ kind: 'load', load: 110, unit: 'lb', change: 'up' });
    expect(
      advice(
        top.map((x) => ({ ...x, logs: x.logs.map((l) => ({ ...l, unit: 'kg' as const })) })),
        bench,
        { unit: 'kg' },
      ),
    ).toEqual({
      kind: 'load',
      load: 102.5,
      unit: 'kg',
      change: 'up',
    });
  });

  it('too hard (RPE 9+) or not at the top: keep the load', () => {
    expect(advice([s([12, 12, 12], 100, 9), s([12, 12, 12], 100, 8)])).toMatchObject({
      load: 100,
      change: 'same',
    });
    expect(advice([s([12, 11, 12], 100), s([12, 12, 12], 100)])).toMatchObject({
      load: 100,
      change: 'same',
    });
  });

  it('reps missed twice: keep; three times: one step lighter', () => {
    expect(advice([s([8, 9], 100), s([9, 8], 100)])).toMatchObject({ load: 100, change: 'same' });
    expect(advice([s([8, 9], 100), s([9, 8], 100), s([9, 9], 100)])).toMatchObject({
      load: 95,
      change: 'down',
    });
  });

  it('bodyweight and bands: +1 rep instead of load', () => {
    // Never past the top of the range (QA R5-02): at the top, keep it.
    expect(advice([s([12, 12]), s([12, 12])], pushUp)).toEqual({
      kind: 'reps',
      reps: 12,
      change: 'same',
    });
    expect(advice([], pushUp)).toBeNull();
  });

  it('60+ and joint care: +1 rep before any load', () => {
    const top = [s([12, 12, 12], 20), s([12, 12, 12], 20)];
    expect(advice(top, bench, { mode: 'senior' })).toEqual({
      kind: 'reps',
      reps: 13,
      change: 'up',
      // The load stays at 20 lb on a "+1 rep" day (QA R4-10).
      load: 20,
      unit: 'lb',
    });
    expect(advice(top, bench, { jointCare: true })).toEqual({
      kind: 'reps',
      reps: 13,
      change: 'up',
      // The load stays at 20 lb on a "+1 rep" day (QA R4-10).
      load: 20,
      unit: 'lb',
    });
    const beaten = [s([13, 13, 13], 20), s([12, 12, 12], 20)];
    // 60+: a barbell's real step is 5 lb, 25% of 20 lb: reps go to the top
    // + 2 first (Daniel, Phase 18), then the load.
    expect(advice(beaten, bench, { mode: 'senior' })).toEqual({
      kind: 'reps',
      reps: 14,
      change: 'up',
      load: 20,
      unit: 'lb',
    });
    const topPlusTwo = [s([14, 14, 14], 20), s([13, 13, 13], 20)];
    expect(advice(topPlusTwo, bench, { mode: 'senior' })).toEqual({
      kind: 'load',
      load: 25,
      unit: 'lb',
      change: 'up',
    });
  });

  it('teens take the small step even on leg lifts; deload keeps the load', () => {
    const top = [s([12, 12], 50), s([12, 12], 50)];
    expect(advice(top, squat, { mode: 'teen' })).toMatchObject({ load: 55 });
    expect(advice(top, bench, { deload: true })).toMatchObject({ load: 50, change: 'same' });
  });

  it('"3 × 10–12 · 25 lb" text', () => {
    expect(loadText({ kind: 'load', load: 25, unit: 'lb', change: 'same' }, 'lb')).toBe('25 lb');
    expect(loadText({ kind: 'first' }, 'lb')).toBeNull();
  });
});

describe('R8-07 load steps never jump', () => {
  const SEED = (seed.exercises as SeedExercise[]).map(fromSeed);
  const kbDeadlift = SEED.find((e) => e.slug === 'rp_kettlebell_deadlift_floor')!;
  const barbellSquat = SEED.find((e) => e.slug === 'barbell_back_squat')!;
  const kbLower = SEED.find((e) => e.slug === 'rp_bench_kettlebell_lift')!;
  const dbLower = SEED.find(
    (e) => e.loaded && e.equipment.join() === 'dumbbells' && isLowerBody(e) && !e.rehab,
  )!;
  const up = (exercise: typeof bench, load: number, unit: 'lb' | 'kg') =>
    loadAdvice({
      sessions: [s([12, 12, 12], load, 7, unit), s([12, 12, 12], load, 7, unit)],
      range: [10, 12],
      exercise,
      unit,
      mode: 'adult',
    });

  it('adult kettlebell in kg moves one bell: 16 → 20, 8 → 12', () => {
    expect(up(kbLower, 16, 'kg')).toMatchObject({ kind: 'load', load: 20 });
    expect(up(kbDeadlift, 8, 'kg')).toMatchObject({ kind: 'load', load: 12 });
    expect(up(kbLower, 35, 'lb')).toMatchObject({ kind: 'load', load: 45 });
  });

  it('no step is over ~25% of the load, and never under one real step', () => {
    // An empty bar: 20 kg + 5 kg is exactly 25%.
    expect(up(barbellSquat, 20, 'kg')).toMatchObject({ load: 25 });
    // 10 kg on a lower lift: the 5 kg step is capped to one 2.5 kg plate step.
    expect(up(barbellSquat, 10, 'kg')).toMatchObject({ load: 12.5 });
    // A heavy lift keeps the normal lower-body step.
    expect(up(barbellSquat, 100, 'kg')).toMatchObject({ load: 105 });
    expect(up(barbellSquat, 225, 'lb')).toMatchObject({ load: 235 });
    // Dumbbells in kg: 5 kg rounds to 4 kg (two 2 kg steps), 6 kg dumbbells go to 8.
    expect(up(dbLower, 16, 'kg')).toMatchObject({ load: 20 });
    expect(up(dbLower, 6, 'kg')).toMatchObject({ load: 8 });
  });
});
