/**
 * QA round 3 — generator P1: readiness tolerance per muscle (R3-04), the
 * short mobility session (R3-05) and the protected balance item (R3-08).
 */
import i18n from '@/i18n';

import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { countsAsWorkout } from '../progress/stats';
import { targetText } from '../workout/format';
import { recentSessions, sessionTargets } from '../workout/plan';
import { muscleActivity } from '../workout/recovery';
import type { WorkoutRecord } from '../workout/types';

import {
  generateMobilitySession,
  generateSession,
  getAlternatives,
  mainWorkMuscles,
  type GeneratorInput,
} from './index';
import type { RecentSession } from './types';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const HOUR = 3_600_000;

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
  muscleGoals: [
    { muscleKey: 'quads', goal: 'strengthen' },
    { muscleKey: 'chest', goal: 'strengthen' },
    { muscleKey: 'lats', goal: 'strengthen' },
  ],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');
const at = (ms: number) => new Date(ms).toISOString();
const groupOf = (k: string) => muscleByKey(muscleByKey(k)?.parentKey ?? k)?.movementGroup;

describe('R3-04 readiness: tolerance from session start, per muscle', () => {
  const now = Date.parse('2026-09-28T18:00:00Z');

  it('the same time every other day (47.4 h) gets the same workout again', () => {
    const recent: RecentSession[] = [
      { date: '2026-09-26', at: at(now - 47.4 * HOUR), mainMuscles: ['quads', 'chest', 'lats'] },
    ];
    const s = generateSession({
      ...base,
      now: at(now),
      today: '2026-09-28',
      recentSessions: recent,
    });
    expect(s.error).toBeUndefined();
    const targets = main(s).map((i) => i.targetMuscle);
    expect(targets).toEqual(expect.arrayContaining(['quads', 'chest', 'lats']));
  });

  it('60+: 90 h is enough, 80 h is not', () => {
    const senior = { ...base, mode: 'senior' as const, band: 'senior' as const };
    const s90 = generateSession({
      ...senior,
      now: at(now),
      today: '2026-09-28',
      recentSessions: [{ date: '2026-09-24', at: at(now - 90 * HOUR), mainMuscles: ['quads'] }],
    });
    expect(main(s90).map((i) => i.targetMuscle)).toContain('quads');
    const s80 = generateSession({
      ...senior,
      now: at(now),
      today: '2026-09-28',
      recentSessions: [{ date: '2026-09-25', at: at(now - 80 * HOUR), mainMuscles: ['quads'] }],
    });
    expect(main(s80).map((i) => i.targetMuscle)).not.toContain('quads');
  });

  it('one recent muscle blocks only the moves that train it, not its whole group', () => {
    const s = generateSession({
      ...base,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      exercisesPerSession: 8,
      minutes: 90,
      now: at(now),
      today: '2026-09-28',
      recentSessions: [{ date: '2026-09-27', at: at(now - 24 * HOUR), mainMuscles: ['chest'] }],
    });
    const items = main(s).map((i) => byId.get(i.exerciseId)!);
    // Push work that spares the chest (shoulders, triceps) is still possible.
    expect(
      items.some((e) => groupOf(e.muscles.find((m) => m.role === 'primary')!.muscleKey) === 'push'),
    ).toBe(true);
    for (const e of items)
      for (const m of e.muscles.filter((x) => x.role === 'primary'))
        expect(muscleByKey(m.muscleKey)?.parentKey ?? m.muscleKey).not.toBe('chest');
  });

  it('a 4-days-a-week user (Mon, Tue, Thu, Sat, same hour) gets 4 workouts', () => {
    const recent: RecentSession[] = [];
    const days = [0, 1, 3, 5];
    const monday = Date.parse('2026-09-28T07:00:00Z');
    let built = 0;
    for (const d of days) {
      const start = monday + d * 24 * HOUR;
      const today = at(start).slice(0, 10);
      const s = generateSession({
        ...base,
        muscleGoals: [
          { muscleKey: 'quads', goal: 'strengthen' },
          { muscleKey: 'chest', goal: 'strengthen' },
          { muscleKey: 'lats', goal: 'strengthen' },
          { muscleKey: 'shoulders', goal: 'strengthen' },
          { muscleKey: 'glutes', goal: 'strengthen' },
        ],
        now: at(start),
        today,
        recentSessions: [...recent],
      });
      if (!s.error && main(s).length >= 3) built++;
      recent.unshift({ date: today, at: at(start), mainMuscles: mainWorkMuscles(s, LIBRARY) });
    }
    expect(built).toBe(4);
  });

  it('recovery is measured from the start of the stored session', () => {
    const w = {
      id: 'w1',
      kind: 'regular',
      status: 'done',
      createdAt: '2026-09-26T17:50:00Z',
      startedAt: '2026-09-26T18:00:00Z',
      endedAt: '2026-09-26T19:10:00Z',
      session: {
        items: [],
        minutes: 45,
        warmupMinutes: 6,
        cooldownMinutes: 5,
        notes: [],
        estimatedMinutes: 45,
      },
      logs: [],
      skipped: [],
      swaps: [],
      pains: [],
    } as unknown as WorkoutRecord;
    expect(recentSessions([w], LIBRARY)[0].at).toBe('2026-09-26T18:00:00Z');
  });
});

describe('R3-05 short mobility', () => {
  const days = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];

  it.each(['adult', 'senior'] as const)(
    '%s: warm-up, 3 moves, cool-down, about 10 minutes',
    (mode) => {
      const s = generateMobilitySession({
        ...base,
        mode,
        band: mode,
        location: 'home',
        equipment: [],
        today: days[0],
      });
      expect(s.error).toBeUndefined();
      expect(main(s)).toHaveLength(3);
      expect(s.items[0].role).toBe('warmup');
      expect(s.items.at(-1)!.role).toBe('cooldown');
      expect(s.estimatedMinutes).toBeGreaterThanOrEqual(9);
      expect(s.estimatedMinutes).toBeLessThanOrEqual(12);
    },
  );

  it('the focus rotates day by day: not always the same stretch', () => {
    const leads = days.map((today) => {
      const s = generateMobilitySession({ ...base, location: 'home', equipment: [], today });
      return main(s)[0].exerciseId;
    });
    expect(new Set(leads).size).toBeGreaterThanOrEqual(3);
  });

  it('never turns a muscle red and is not counted as a workout', () => {
    const s = generateMobilitySession({ ...base, location: 'home', equipment: [], today: days[0] });
    expect(mainWorkMuscles(s, LIBRARY)).toEqual([]);
    const w = {
      id: 'm1',
      kind: 'mobility',
      status: 'done',
      createdAt: '2026-09-28T07:00:00Z',
      endedAt: '2026-09-28T07:10:00Z',
      session: s,
      logs: main(s).map((i) => ({
        itemId: i.id,
        exerciseId: i.exerciseId,
        setNo: 1,
        seconds: 30,
        loggedAt: '2026-09-28T07:05:00Z',
      })),
      skipped: [],
      swaps: [],
      pains: [],
    } as unknown as WorkoutRecord;
    expect(muscleActivity([w], LIBRARY, new Date('2026-09-28T08:00:00Z'))).toEqual({});
    expect(countsAsWorkout(w)).toBe(false);
    expect(countsAsWorkout({ ...w, kind: 'regular' })).toBe(true);
  });
});

describe('R3-08 the protected balance item', () => {
  const rosa: GeneratorInput = {
    ...base,
    mode: 'senior',
    band: 'senior',
    location: 'home',
    equipment: [],
    position: 'with_support',
    conditions: ['fell_last_year'],
    muscleGoals: [
      { muscleKey: 'calves', goal: 'strengthen' },
      { muscleKey: 'quads', goal: 'strengthen' },
    ],
    minutes: 30,
  };

  it('is labelled "Balance", not a muscle, and stays out of the title and recovery', () => {
    const s = generateSession(rosa);
    const item = main(s).find(
      (i) => i.goal === 'balance' && byId.get(i.exerciseId)!.pattern === 'balance',
    )!;
    expect(item).toBeTruthy();
    expect(item.targetMuscle).toBeNull();
    expect(targetText(i18n.t.bind(i18n), item, byId.get(item.exerciseId))).toBe('Balance');
    expect(sessionTargets(s, 5)).not.toContain(null);
    const balanceMuscles = byId
      .get(item.exerciseId)!
      .muscles.filter((m) => m.role === 'primary')
      .map((m) => m.muscleKey);
    const trained = main(s)
      .filter((i) => i !== item)
      .flatMap((i) =>
        byId
          .get(i.exerciseId)!
          .muscles.filter((m) => m.role === 'primary')
          .map((m) => m.muscleKey),
      );
    for (const m of balanceMuscles)
      if (!trained.includes(m)) expect(mainWorkMuscles(s, LIBRARY)).not.toContain(m);
  });

  it('swapping it offers only balance moves', () => {
    const s = generateSession(rosa);
    const item = main(s).find((i) => i.goal === 'balance' && !i.targetMuscle)!;
    const alts = getAlternatives(s, item.id, rosa);
    expect(alts.length).toBeGreaterThanOrEqual(3);
    for (const e of alts) expect(e.pattern).toBe('balance');
  });
});
