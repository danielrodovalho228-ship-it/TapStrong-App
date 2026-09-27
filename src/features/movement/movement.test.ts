import seed from '../../../supabase/seed/exercises.json';
import catalogJson from '../../../supabase/seed/joint_movements.json';

import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { generateSession, type GeneratorInput } from '../generator';
import { blockReason } from '../generator/filters';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { jointsForArea, type MovementCatalog, type MovementKey } from './catalog';
import {
  levelFor,
  lightFor,
  lightHistory,
  limitFrom,
  phaseFor,
  recoveryInput,
  retestDue,
  retestSeries,
  seeTherapist,
  workoutLight,
} from './progress';
import { IRRITABLE_SCORE, movementVerdict, type MovementLimit } from './rules';
import type { MovementPain } from './store';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const CATALOG = catalogJson as unknown as MovementCatalog;
const ex = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;

/** The case that started this feature: raising and lowering the arm is fine,
 * sideways and rotation hurt (e.g. reaching sideways in the kitchen). */
const SHOULDER: MovementLimit = {
  area: 'shoulder',
  joints: ['shoulder'],
  painful: [
    'shoulder.abduction',
    'shoulder.external_rotation',
    'shoulder.internal_rotation',
    'shoulder.reach_behind',
  ],
  painFree: ['shoulder.flexion', 'shoulder.push', 'shoulder.pull', 'shoulder.carry'],
  score: 4,
};

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 40,
  mainGoals: ['look'],
  muscleGoals: [
    { muscleKey: 'shoulders', goal: 'grow' },
    { muscleKey: 'upperChest', goal: 'grow' },
  ],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: ['shoulder'],
  conditions: [],
  restrictions: ['shoulder'],
};

const usesPainful = (e: Exercise, limit: MovementLimit) =>
  e.joints.some(
    (j) =>
      limit.joints.includes(j.joint) &&
      !limit.painFree.includes(`${j.joint}.${j.movement}` as MovementKey) &&
      j.range !== 'isometric',
  );

describe('movement verdict (SPEC §8 "Movement that hurts")', () => {
  const opts = { allowReducedRange: true };

  it('1. leaves out an exercise that needs a painful movement', () => {
    expect(movementVerdict(ex('dumbbell_shoulder_press'), [SHOULDER], opts)).toBe('blocked');
    expect(movementVerdict(ex('band_face_pull'), [SHOULDER], opts)).toBe('blocked');
  });

  it('2. keeps exercises that only use pain-free movements, even if the area is ruled out', () => {
    expect(ex('band_front_raise').contraindications).toContain('shoulder');
    expect(movementVerdict(ex('band_front_raise'), [SHOULDER], opts)).toBe('ok');
    expect(movementVerdict(ex('band_row'), [SHOULDER], opts)).toBe('ok');
    expect(movementVerdict(ex('bodyweight_squat'), [SHOULDER], opts)).toBe('ok');
  });

  it('3. uses a shorter range when the exercise allows it for that movement', () => {
    expect(ex('doorway_chest_stretch').rangeLimit).toContain('shoulder.abduction');
    expect(movementVerdict(ex('doorway_chest_stretch'), [SHOULDER], opts)).toBe('reduced');
    expect(
      movementVerdict(ex('doorway_chest_stretch'), [SHOULDER], { allowReducedRange: false }),
    ).toBe('blocked');
  });

  it('treats a movement the person did not rate as painful', () => {
    const unrated = { ...SHOULDER, painFree: [] as MovementKey[] };
    expect(movementVerdict(ex('band_row'), [unrated], opts)).toBe('blocked');
  });

  it('allows a gentle hold in the painful direction only while pain is low', () => {
    const hold = ex('iso_shoulder_abduction');
    expect(movementVerdict(hold, [SHOULDER], opts)).toBe('isometric');
    expect(movementVerdict(hold, [{ ...SHOULDER, score: 6 }], opts)).toBe('blocked');
  });

  it(`an irritable joint (pain ${IRRITABLE_SCORE}+) leaves out every movement of it`, () => {
    const hot = { ...SHOULDER, score: IRRITABLE_SCORE };
    expect(movementVerdict(ex('band_front_raise'), [hot], opts)).toBe('blocked');
    expect(movementVerdict(ex('bodyweight_squat'), [hot], opts)).toBe('ok');
  });

  it('an exercise ruled out for the area but untagged for its joints stays out', () => {
    const untagged = { ...ex('dumbbell_shrug'), joints: [] };
    const neck: MovementLimit = {
      area: 'neck',
      joints: ['neck'],
      painful: ['neck.rotation'],
      painFree: [],
      score: 3,
    };
    expect(movementVerdict(untagged, [neck], opts)).toBe('blocked');
  });

  it('maps elbow / wrist to two joints', () => {
    expect(jointsForArea(CATALOG, 'elbow_wrist')).toEqual(['elbow', 'wrist']);
    expect(jointsForArea(CATALOG, 'shoulder')).toEqual(['shoulder']);
  });
});

describe('generator with a movement limit', () => {
  const input = { ...base, movementLimits: [SHOULDER] };

  it('never picks an exercise that needs a painful movement, in any part', () => {
    const s = generateSession(input);
    expect(s.error).toBeUndefined();
    for (const item of s.items) {
      const e = ex(item.exerciseId);
      if (usesPainful(e, SHOULDER)) expect(item.range).toBe('reduced');
    }
  });

  it('replaces the whole-area restriction: pain-free shoulder work comes back', () => {
    expect(blockReason(ex('seated_chest_press_machine'), base)).toBe('contraindication');
    expect(blockReason(ex('seated_chest_press_machine'), input)).toBeNull();
    expect(blockReason(ex('dumbbell_shoulder_press'), input)).toBe('painful_movement');
  });

  it('keeps warm-up first and cool-down last', () => {
    for (const minutes of [15, 30, 60]) {
      const s = generateSession({ ...input, minutes });
      expect(s.items[0].role).toBe('warmup');
      expect(s.items.at(-1)!.role).toBe('cooldown');
    }
  });

  it('marks shorter-range items so the player can say so', () => {
    const s = generateSession({
      ...input,
      library: LIBRARY.filter((e) => e.slug !== 'cross_body_shoulder_stretch'),
      muscleGoals: [{ muscleKey: 'chest', goal: 'grow' }],
    });
    const reduced = s.items.filter((i) => i.range === 'reduced');
    for (const i of reduced) expect(ex(i.exerciseId).rangeLimit.length).toBeGreaterThan(0);
  });

  it('recovery-only exercises never appear in regular workouts', () => {
    for (const minutes of [15, 30, 60]) {
      const s = generateSession({ ...input, minutes, painAreas: [], restrictions: [] });
      expect(s.items.some((i) => ex(i.exerciseId).rehab)).toBe(false);
    }
    expect(blockReason(ex('iso_shoulder_abduction'), base)).toBe('rehab_only');
  });

  it('is deterministic', () => {
    expect(generateSession(input)).toEqual(generateSession(input));
  });
});

const report = (patch: Partial<MovementPain> = {}): MovementPain => ({
  id: 'r1',
  area: 'shoulder',
  joints: ['shoulder'],
  side: 'right',
  painful: SHOULDER.painful,
  painFree: SHOULDER.painFree,
  score: 4,
  duration: '2_6_weeks',
  active: true,
  createdAt: '2026-09-01T09:00:00.000Z',
  checks: [],
  retests: [],
  ...patch,
});

describe('pain traffic light', () => {
  it('0–3 green, 4–5 yellow, over 5 red', () => {
    expect([0, 3, 4, 5, 6, 10].map(lightFor)).toEqual([
      'green',
      'green',
      'yellow',
      'yellow',
      'red',
      'red',
    ]);
  });

  it('worse the next morning is red', () => {
    expect(workoutLight(2, 4, 2)).toBe('red');
    expect(workoutLight(2, 3, 2)).toBe('green');
    expect(workoutLight(2, 2, 2)).toBe('green');
    expect(workoutLight(4, undefined, 4)).toBe('yellow');
  });

  const check = (workoutId: string, kind: 'after' | 'morning', score: number, day: number) => ({
    workoutId,
    kind,
    score,
    at: new Date(Date.UTC(2026, 8, day, kind === 'after' ? 18 : 8)).toISOString(),
  });

  it('moves on after green, holds on yellow, steps back on red', () => {
    const r = report({
      checks: [
        check('w1', 'after', 2, 2),
        check('w1', 'morning', 2, 3), // green → level 2
        check('w2', 'after', 3, 4),
        check('w2', 'morning', 3, 5), // green → level 3
        check('w3', 'after', 5, 6),
        check('w3', 'morning', 3, 7), // yellow → hold
        check('w4', 'after', 7, 8), // red right after → back to level 2
      ],
    });
    expect(lightHistory(r).map((s) => s.light)).toEqual(['green', 'green', 'yellow', 'red']);
    expect(levelFor(r)).toBe(2);
  });

  it('waits for the morning check unless right after is already red', () => {
    const r = report({ checks: [check('w1', 'after', 1, 2)] });
    expect(lightHistory(r)).toEqual([]);
    expect(levelFor(r)).toBe(1);
  });

  it('phases follow the level', () => {
    expect([1, 2, 3, 4, 5, 6].map(phaseFor)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('weekly retest and physical therapist advice', () => {
  const now = new Date('2026-09-26T09:00:00.000Z');

  it('is due every 7 days', () => {
    expect(retestDue(report(), new Date('2026-09-05T09:00:00.000Z'))).toBe(false);
    expect(retestDue(report(), new Date('2026-09-08T09:00:00.000Z'))).toBe(true);
    const r = report({ retests: [{ at: '2026-09-20T09:00:00.000Z', scores: {} }] });
    expect(retestDue(r, now)).toBe(false);
  });

  it('charts the report and each retest', () => {
    const r = report({
      retests: [
        {
          at: '2026-09-08T09:00:00.000Z',
          scores: { 'shoulder.abduction': 3, 'shoulder.reach_behind': 4 },
        },
      ],
    });
    expect(retestSeries(r).map((p) => p.score)).toEqual([4, 3.5]);
  });

  it('recommends a physical therapist when worse, or no better after 3 weeks', () => {
    const better = report({
      retests: [{ at: '2026-09-22T09:00:00.000Z', scores: { 'shoulder.abduction': 2 } }],
    });
    expect(seeTherapist(better, now)).toBe(false);
    const same = report({
      retests: [{ at: '2026-09-22T09:00:00.000Z', scores: { 'shoulder.abduction': 4 } }],
    });
    expect(seeTherapist(same, now)).toBe(true);
    expect(seeTherapist(same, new Date('2026-09-15T09:00:00.000Z'))).toBe(false);
    const worse = report({
      retests: [{ at: '2026-09-08T09:00:00.000Z', scores: { 'shoulder.abduction': 6 } }],
    });
    expect(seeTherapist(worse, new Date('2026-09-09T09:00:00.000Z'))).toBe(true);
  });
});

describe('recovery plan (inside Repair)', () => {
  const input = { ...base, movementLimits: [limitFrom(report())], minutes: 15 };

  it('phase 1: gentle holds and pain-free range only, no shorter-range work', () => {
    const r = report();
    const s = generateSession(recoveryInput(input, r, CATALOG));
    expect(s.error).toBeUndefined();
    const main = s.items.filter((i) => i.role === 'main').map((i) => ex(i.exerciseId));
    expect(main.length).toBeGreaterThan(0);
    for (const e of main) {
      const uses = e.joints.filter((j) => j.joint === 'shoulder');
      expect(uses.length).toBeGreaterThan(0);
      expect(uses.some((u) => u.range === 'isometric') || !usesPainful(e, limitFrom(r))).toBe(true);
    }
    expect(s.items.some((i) => i.range === 'reduced')).toBe(false);
    expect(s.items[0].role).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
  });

  it('phase 3 allows a shorter range and more sets', () => {
    const greens = [2, 4, 6, 8, 10].flatMap((d, n) => [
      {
        workoutId: `w${n}`,
        kind: 'after' as const,
        score: 1,
        at: `2026-09-${String(d).padStart(2, '0')}T18:00:00.000Z`,
      },
      {
        workoutId: `w${n}`,
        kind: 'morning' as const,
        score: 1,
        at: `2026-09-${String(d + 1).padStart(2, '0')}T08:00:00.000Z`,
      },
    ]);
    const r = report({ checks: greens });
    expect(phaseFor(levelFor(r))).toBe(3);
    const next = recoveryInput(input, r, CATALOG);
    expect(next.allowReducedRange).toBe(true);
    expect(next.setsPerExercise).toBe(3);
    expect(next.muscleGoals.map((g) => g.muscleKey)).toEqual(CATALOG.joints.shoulder.focus['3']);
  });

  it('uses only muscles from the database', () => {
    const { MUSCLE_KEYS } = jest.requireActual('../muscles') as { MUSCLE_KEYS: string[] };
    for (const j of Object.values(CATALOG.joints))
      for (const list of Object.values(j.focus))
        for (const m of list) expect(MUSCLE_KEYS).toContain(m);
  });
});

describe('morning check notification and sync', () => {
  it('asks for the morning check at 8:30 the day after, until it is answered', () => {
    const { planNotifications } = jest.requireActual(
      '../notifications/plan',
    ) as typeof import('../notifications/plan');
    const { pendingMorningChecks } = jest.requireActual(
      './progress',
    ) as typeof import('./progress');
    const after = new Date(2026, 8, 26, 18, 0).toISOString();
    const r = report({ checks: [{ workoutId: 'w1', kind: 'after', score: 3, at: after }] });
    const pending = pendingMorningChecks([r]);
    expect(pending).toEqual([
      { reportId: 'r1', area: 'shoulder', workoutId: 'w1', afterAt: after },
    ]);
    const plan = planNotifications({
      prefs: {
        reminders: false,
        reminderTime: '18:00',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
      daysPerWeek: 3,
      streak: 0,
      lastActive: null,
      now: new Date(2026, 8, 26, 19, 0),
      morningChecks: pending,
    });
    expect(plan).toEqual([
      expect.objectContaining({ kind: 'movement_check', date: new Date(2026, 8, 27, 8, 30) }),
    ]);
    const answered = report({
      checks: [
        { workoutId: 'w1', kind: 'after', score: 3, at: after },
        {
          workoutId: 'w1',
          kind: 'morning',
          score: 2,
          at: new Date(2026, 8, 27, 8, 40).toISOString(),
        },
      ],
    });
    expect(pendingMorningChecks([answered])).toEqual([]);
    expect(pendingMorningChecks([{ ...r, active: false }])).toEqual([]);
  });

  it('Repair tests are tagged with catalog movements', () => {
    const repair = jest.requireActual('../../../supabase/seed/repair_tests.json') as {
      tests: { key: string; joints: [string, string, string][] }[];
    };
    for (const t of repair.tests) {
      expect(t.joints.length).toBeGreaterThan(0);
      for (const [joint, movement] of t.joints) {
        expect(CATALOG.joints[joint as 'shoulder'].movements).toContain(movement);
      }
    }
  });
});
