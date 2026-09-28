/**
 * Improvements v1, package A — pure logic: week strip, program blocks and
 * deload, day names, session summary, ready-made plans, custom workouts.
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import {
  generateCustomSession,
  generateSession,
  safePool,
  type GeneratorInput,
} from '../generator';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import type { WorkoutRecord } from '../workout/types';

import { planDayIndex, programStatus, withProgram } from './apply';
import { blockWeek, dayName, deloadSets, sessionSummary } from './block';
import { findPlans, planById, planDayInput, READY_PLANS } from './plans';
import { plannedOffsets, weekStrip } from './week';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const done = (date: string, kind: WorkoutRecord['kind'] = 'regular'): WorkoutRecord => ({
  id: `w-${date}-${kind}`,
  kind,
  createdAt: `${date}T09:00:00`,
  endedAt: `${date}T10:00:00`,
  status: 'done',
  session: generateSession(base),
  logs: [{ itemId: 'x', exerciseId: 'push_up', setNo: 1, reps: 10, loggedAt: `${date}T09:30:00` }],
  skipped: [],
  swaps: [],
  pains: [],
});
const toLocal = (iso: string) => iso.slice(0, 10);
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

describe('week strip (A1)', () => {
  it('7 days from the phone week start, today marked, trained and planned dots', () => {
    const days = weekStrip({
      today: '2026-09-30', // a Wednesday
      startsOn: 0,
      daysPerWeek: 3,
      workouts: [done('2026-09-28')],
      toLocal,
    });
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-09-27');
    expect(days.find((d) => d.today)?.date).toBe('2026-09-30');
    expect(days.find((d) => d.date === '2026-09-28')?.mark).toBe('trained');
    // Planned days only from today on: Mon (past, not trained) has no hollow dot.
    const planned = days.filter((d) => d.mark === 'planned').map((d) => d.date);
    expect(planned.every((d) => d >= '2026-09-30')).toBe(true);
    expect(planned.length).toBeGreaterThan(0);
  });

  it('planned days are spread with rest between them', () => {
    expect(plannedOffsets(3)).toEqual([1, 3, 5]);
    expect(plannedOffsets(2)).toEqual([1, 4]);
    expect(plannedOffsets(9)).toHaveLength(7);
  });
});

describe('program blocks and deload (A2)', () => {
  it('"Week 3 of 5 · Build", the last week a deload', () => {
    expect(blockWeek('2026-09-01', '2026-09-15')).toEqual({ week: 3, of: 5, phase: 'build' });
    expect(blockWeek('2026-09-01', '2026-09-29')).toEqual({ week: 5, of: 5, phase: 'deload' });
    expect(blockWeek('2026-09-01', '2026-10-06').week).toBe(1);
    expect(blockWeek('2026-09-01', '2026-09-01', 9).of).toBe(6);
  });

  it('deload cuts volume by 40%, never below 1 set, same exercises', () => {
    expect(deloadSets(3)).toBe(1); // at least 40% fewer (QA R4 P2)
    expect(deloadSets(4)).toBe(2);
    expect(deloadSets(5)).toBe(3);
    expect(deloadSets(1)).toBe(1);
    const normal = generateSession(base);
    const light = generateSession({ ...base, deload: true });
    expect(light.deload).toBe(true);
    expect(main(light).map((i) => i.exerciseId)).toEqual(main(normal).map((i) => i.exerciseId));
    for (const i of main(light).filter((x) => x.goal !== 'balance')) expect(i.sets).toBe(1);
  });

  it('withProgram applies the deload week to the generator input', () => {
    const start = { planId: null, startedAt: '2026-09-01' };
    expect(withProgram(base, LIBRARY, [], start, '2026-09-29').deload).toBe(true);
    expect(withProgram(base, LIBRARY, [], start, '2026-09-15').deload).toBeUndefined();
  });
});

describe('day names and summary (A2, A3)', () => {
  it('names the day from what it trains', () => {
    const push = generateSession({
      ...base,
      exercisesPerSession: 1,
      muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
    });
    expect(dayName(push, LIBRARY)).toBe('push');
    expect(dayName(push, LIBRARY, 'repair')).toBe('repair');
    expect(dayName({ ...push, focus: 'mobility' }, LIBRARY)).toBe('mobility');
    const full = generateSession({
      ...base,
      muscleGoals: ['chest', 'lats', 'quads'].map((muscleKey) => ({
        muscleKey,
        goal: 'strengthen' as const,
      })),
    });
    expect(dayName(full, LIBRARY)).toBe('fullBody');
  });

  it('"6 exercises · 45 min" and kcal only for adults and 60+', () => {
    const s = generateSession(base);
    const adult = sessionSummary(s, 'adult', 70);
    expect(adult.exercises).toBe(main(s).length);
    expect(adult.kcal).toBeGreaterThan(0);
    expect(sessionSummary(s, 'senior', 70).kcal).toBeGreaterThan(0);
    expect(sessionSummary(s, 'teen', 60).kcal).toBeNull();
    expect(sessionSummary(s, 'adult', undefined).kcal).toBeNull();
  });
});

describe('ready-made plans (A5)', () => {
  it('cards for 2–6 days, every goal and split, by age mode', () => {
    const days = new Set(READY_PLANS.map((p) => p.daysPerWeek));
    expect([...days].sort()).toEqual([2, 3, 4, 5, 6]);
    expect(new Set(READY_PLANS.map((p) => p.goal)).size).toBe(6);
    expect(new Set(READY_PLANS.map((p) => p.split)).size).toBe(3);
    // Teens: no weight-loss or 60+ plans; 60+ plans lead for seniors.
    const teen = findPlans('teen');
    expect(teen.some((p) => p.goal === 'weightLoss' || p.goal === 'seniorSteady')).toBe(false);
    expect(findPlans('senior')[0].goal).toBe('seniorSteady');
    expect(findPlans('child')).toEqual([]);
    expect(
      findPlans('adult', { days: 3, split: 'ppl' }).every(
        (p) => p.daysPerWeek === 3 && p.split === 'ppl',
      ),
    ).toBe(true);
  });

  it('a plan sets the split and targets; the generator still picks safe exercises', () => {
    const plan = planById('muscle-ppl-3')!;
    const withKnee = { ...base, restrictions: ['knee'] };
    const days = [0, 1, 2].map((i) => planDayInput(withKnee, plan, i, LIBRARY));
    expect(days.map((d) => d.mainGoals)).toEqual([['look'], ['look'], ['look']]);
    // Push day, pull day, legs day.
    expect(days[0].muscleGoals.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(d.restrictions).toEqual(['knee']);
      const s = generateSession(d);
      const safe = new Set(safePool(d).map((e) => e.id));
      for (const i of main(s)) expect(safe.has(i.exerciseId)).toBe(true);
    }
  });

  it('the plan day follows the regular workouts done since it started', () => {
    const history = [done('2026-09-20'), done('2026-09-22'), done('2026-09-23', 'mobility')];
    expect(planDayIndex(history, '2026-09-21')).toBe(1);
    expect(planDayIndex(history, null)).toBe(2);
    const status = programStatus(
      { planId: 'muscle-ppl-3', startedAt: '2026-09-21' },
      history,
      '2026-09-28',
    );
    expect(status.plan?.id).toBe('muscle-ppl-3');
    expect(status.dayIndex).toBe(1);
  });

  it('"My plan" (no plan chosen) keeps the coach targets', () => {
    const input = withProgram(
      base,
      LIBRARY,
      [],
      { planId: null, startedAt: '2026-09-21' },
      '2026-09-28',
    );
    expect(input.muscleGoals).toEqual(base.muscleGoals);
  });
});

describe('custom workouts (A6)', () => {
  it('keeps the person’s list, adds warm-up and cool-down, leaves out unsafe picks', () => {
    const picks = ['barbell_bench_press', 'lat_pulldown', 'knee_push_up'];
    const input = { ...base, restrictions: ['knee'] };
    const s = generateCustomSession(input, picks);
    expect(s.items[0].role).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
    const ids = main(s).map((i) => i.exerciseId);
    expect(ids).toEqual(['barbell_bench_press', 'lat_pulldown']);
    expect(s.notes).toContainEqual({ key: 'generator.notes.customLeftOut', count: 1 });
    expect(byId.get('knee_push_up')!.contraindications).toContain('knee');
  });

  it('nothing safe chosen: no workout', () => {
    expect(generateCustomSession({ ...base, restrictions: ['knee'] }, ['knee_push_up']).error).toBe(
      'no_main',
    );
  });
});
