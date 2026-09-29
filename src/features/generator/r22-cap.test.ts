/**
 * QA round 9 — weekly cap (R9-06..08, Daniel's decisions 1–3): abs counted
 * once, no balance holds for a capped muscle, a clear note or a weekly-limit
 * result, the joint budget, Repair never cut, kids 10, and tests that fail
 * with the cap switched off (history seeded near the cap).
 */
import { devLibrary } from '../exercises/library';
import { movedAreas } from '../movement/catalog';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { planById, planDayInput } from '../program/plans';
import { recentSessions } from '../workout/plan';
import type { WorkoutRecord } from '../workout/types';
import { setKidsUnder13Enabled } from '@/lib/features';

import { generateSession, JOINT_CARE_WEEKLY_SETS, WEEKLY_SETS } from './generate';
import { maxWeeklySets, simulate } from './r8-sim';
import type { GeneratorInput, RecentSession } from './types';

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = (s: string) => LIBRARY.find((e) => e.slug === s)!;
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 90,
  mainGoals: ['look'],
  muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
  exercisesPerSession: 6,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const day = (
  date: string,
  muscleSets: Record<string, number>,
  extra: Partial<RecentSession> = {},
) =>
  ({
    date,
    at: `${date}T12:00:00Z`,
    mainMuscles: Object.keys(muscleSets),
    exerciseIds: [],
    muscleSets,
    ...extra,
  }) as RecentSession;
const mainOf = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');
const parent = (k: string) => (['upperChest', 'midChest', 'lowerChest'].includes(k) ? 'chest' : k);
const setsOn = (s: ReturnType<typeof generateSession>, muscle: string) =>
  mainOf(s)
    .filter((i) =>
      byId
        .get(i.exerciseId)!
        .muscles.some((m) => m.role === 'primary' && parent(m.muscleKey) === muscle),
    )
    .reduce((n, i) => n + i.sets, 0);

describe('R9-06 abs counted once per set', () => {
  it('10 plank sets in history are 10 abs sets, not 20', () => {
    const plank = bySlug('plank');
    const at = '2026-09-26T09:00:00';
    const w = {
      id: 'w',
      kind: 'regular',
      status: 'done',
      createdAt: at,
      startedAt: at,
      endedAt: at,
      session: {
        items: [
          {
            id: 'm',
            role: 'main',
            part: 'main',
            exerciseId: plank.id,
            targetMuscle: 'abs',
            goal: null,
            sets: 10,
            restSeconds: 30,
            perSide: false,
            loadHint: null,
            estSeconds: 60,
          },
        ],
        minutes: 30,
        warmupMinutes: 5,
        cooldownMinutes: 5,
        estimatedMinutes: 30,
        notes: [],
      },
      logs: Array.from({ length: 10 }, (_, n) => ({
        itemId: 'm',
        exerciseId: plank.id,
        setNo: n + 1,
        seconds: 30,
        loggedAt: at,
      })),
      skipped: [],
      swaps: [],
      pains: [],
    } as unknown as WorkoutRecord;
    const [r] = recentSessions([w], LIBRARY);
    expect(r.muscleSets).toEqual({ abs: 10 });
  });
});

describe('R9-07 a capped muscle', () => {
  const capped = (muscles: string[], n = 20) => [
    day('2026-09-25', Object.fromEntries(muscles.map((m) => [m, n]))),
  ];

  it('quads + glutes at 20: no balance holds in their place, a weekly-cap note', () => {
    const s = generateSession({
      ...base,
      muscleGoals: [
        { muscleKey: 'quads', goal: 'grow' },
        { muscleKey: 'glutes', goal: 'grow' },
      ],
      recentSessions: capped(['quads', 'glutes']),
    });
    expect(s.error).toBeUndefined();
    for (const i of mainOf(s)) expect(byId.get(i.exerciseId)!.pattern).not.toBe('balance');
    expect(setsOn(s, 'quads')).toBe(0);
    expect(setsOn(s, 'glutes')).toBe(0);
    expect(s.notes).toContainEqual({
      key: 'generator.notes.weeklyCap',
      muscles: ['quads', 'glutes'],
    });
    expect(s.notes.map((n) => n.key)).not.toContain('generator.notes.substituted');
    expect(s.notes.map((n) => n.key)).not.toContain('generator.notes.unavailable');
  });

  it('60+ home, quads at 12: no sit-to-stand hold leads', () => {
    const s = generateSession({
      ...base,
      mode: 'senior',
      band: 'senior',
      location: 'home',
      equipment: ['chair', 'dumbbells'],
      minutes: 45,
      exercisesPerSession: 4,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      recentSessions: capped(['quads'], 12),
    });
    for (const i of mainOf(s)) {
      const e = byId.get(i.exerciseId)!;
      expect(e.pattern === 'balance' && e.muscles.some((m) => m.muscleKey === 'quads')).toBe(false);
    }
  });

  it('a push day with chest, triceps and shoulders capped builds from other groups', () => {
    const ppl = planById('muscle-ppl-3')!;
    const input = planDayInput(
      { ...base, recentSessions: capped(['chest', 'triceps', 'shoulders']) },
      ppl,
      0,
      LIBRARY,
    );
    const s = generateSession(input);
    expect(s.error).toBeUndefined();
    expect(mainOf(s).length).toBeGreaterThan(0);
    expect(s.notes[0]).toMatchObject({ key: 'generator.notes.weeklyCap' });
    for (const m of ['chest', 'triceps', 'shoulders']) expect(setsOn(s, m)).toBe(0);
  });

  it('everything capped: a clear weekly-limit result, not "no safe exercise"', () => {
    const all = [
      ...new Set(
        LIBRARY.flatMap((e) =>
          e.muscles.map((m) => muscleByKey(m.muscleKey)?.parentKey ?? m.muscleKey),
        ),
      ),
    ];
    const s = generateSession({ ...base, recentSessions: capped(all, 40) });
    expect(s.error).toBe('weekly_cap');
  });

  it('a move that would fit only 1 more set is skipped, never a 1-set item', () => {
    const s = generateSession({ ...base, minutes: 45, recentSessions: capped(['chest'], 19) });
    for (const i of mainOf(s)) expect(i.sets).toBeGreaterThanOrEqual(2);
    expect(setsOn(s, 'chest')).toBe(0);
  });
});

describe("Daniel's decision 1: the joint budget", () => {
  it('knee pain: knee-loading moves stop at 12 a week, glutes may use non-knee moves up to 20', () => {
    const s = generateSession({
      ...base,
      painAreas: ['knee'],
      muscleGoals: [
        { muscleKey: 'quads', goal: 'grow' },
        { muscleKey: 'glutes', goal: 'grow' },
      ],
      recentSessions: [day('2026-09-26', { glutes: 12 }, { jointSets: { knee: 12 } })],
    });
    // Moves that only hold the knee still don't use it (R10 decision 3).
    for (const i of mainOf(s))
      expect(movedAreas(byId.get(i.exerciseId)!.joints)).not.toContain('knee');
    expect(setsOn(s, 'glutes')).toBeGreaterThan(0);
    expect(setsOn(s, 'glutes')).toBeLessThanOrEqual(WEEKLY_SETS.adult - 12);
    expect(JOINT_CARE_WEEKLY_SETS).toBe(12);
  });

  it('over 5 weeks a knee-pain adult never passes 12 knee sets in 7 days', () => {
    const sim = simulate({
      base: { ...base, painAreas: ['knee'], muscleGoals: [{ muscleKey: 'quads', goal: 'grow' }] },
      library: LIBRARY,
      start: '2026-09-07',
      weekdays: [1, 2, 3, 4, 5, 6],
      weeks: 5,
    });
    const knee = sim.map((d) => ({ ...d, muscleSets: { knee: d.jointSets?.knee ?? 0 } }));
    expect(maxWeeklySets(knee).sets).toBeLessThanOrEqual(12);
  });
});

describe("Daniel's decision 2: Repair and finishers", () => {
  it('a finisher and a Repair session count toward the cap', () => {
    const s = generateSession({
      ...base,
      recentSessions: [
        day('2026-09-26', { chest: 10 }, { kind: 'finisher' }),
        day('2026-09-25', { chest: 10 }, { kind: 'repair' }),
      ],
    });
    expect(setsOn(s, 'chest')).toBe(0);
  });

  it('a Repair session is never cut by the cap', () => {
    const normal = generateSession({
      ...base,
      rehab: true,
      muscleGoals: [{ muscleKey: 'glutes', goal: 'strengthen' }],
    });
    const capped = generateSession({
      ...base,
      rehab: true,
      muscleGoals: [{ muscleKey: 'glutes', goal: 'strengthen' }],
      recentSessions: [day('2026-09-25', { glutes: 30 })],
    });
    expect(mainOf(capped).map((i) => [i.exerciseId, i.sets])).toEqual(
      mainOf(normal).map((i) => [i.exerciseId, i.sets]),
    );
  });
});

describe("Daniel's decision 3: kids 10", () => {
  afterEach(() => setKidsUnder13Enabled(false));
  it('a child never gets more than 10 sets of a muscle in 7 days', () => {
    setKidsUnder13Enabled(true);
    expect(WEEKLY_SETS.child).toBe(10);
    const s = generateSession({
      ...base,
      mode: 'child',
      band: 'kid',
      location: 'home',
      equipment: [],
      minutes: 45,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      recentSessions: [day('2026-09-26', { quads: 9 })],
    });
    expect(setsOn(s, 'quads')).toBe(0);
  });
});

describe('the cap tests fail with the cap off (history near the cap)', () => {
  it.each([
    ['adult Upper/Lower 5', {}, 'muscle-upperLower-5', 16, 20],
    ['60+ full body 4', { mode: 'senior', band: 'senior' }, null, 10, 12],
    ['teen 4 days', { mode: 'teen', band: 'teen' }, null, 12, 14],
  ] as const)('%s: seeded near the cap, never over it', (_n, patch, plan, seeded, cap) => {
    const muscles = [
      'chest',
      'back',
      'lats',
      'upperBack',
      'shoulders',
      'quads',
      'glutes',
      'hamstrings',
      'abs',
    ];
    const recent = [day('2026-09-26', Object.fromEntries(muscles.map((m) => [m, seeded])))];
    const input = { ...base, ...(patch as Partial<GeneratorInput>), recentSessions: recent };
    const s = generateSession(plan ? planDayInput(input, planById(plan)!, 0, LIBRARY) : input);
    for (const m of muscles)
      expect({ m, total: seeded + setsOn(s, m) }).toMatchObject({ total: expect.any(Number) });
    for (const m of muscles) expect(seeded + setsOn(s, m)).toBeLessThanOrEqual(cap);
  });
});
