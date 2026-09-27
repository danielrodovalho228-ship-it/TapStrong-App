/**
 * Improvements v1, A4 — suggested load and progression, deterministic.
 */
import { devLibrary } from '../exercises/library';

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
    expect(advice([s([12, 12]), s([12, 12])], pushUp)).toEqual({
      kind: 'reps',
      reps: 13,
      change: 'up',
    });
    expect(advice([], pushUp)).toBeNull();
  });

  it('60+ and joint care: +1 rep before any load', () => {
    const top = [s([12, 12, 12], 20), s([12, 12, 12], 20)];
    expect(advice(top, bench, { mode: 'senior' })).toEqual({
      kind: 'reps',
      reps: 13,
      change: 'up',
    });
    expect(advice(top, bench, { jointCare: true })).toEqual({
      kind: 'reps',
      reps: 13,
      change: 'up',
    });
    const beaten = [s([13, 13, 13], 20), s([12, 12, 12], 20)];
    expect(advice(beaten, bench, { mode: 'senior' })).toEqual({
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
