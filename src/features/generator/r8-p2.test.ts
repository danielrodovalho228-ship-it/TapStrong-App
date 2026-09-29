/**
 * QA round 8 — P2 (generator): spare time becomes sets, never exercises
 * (Daniel, Phase 20); a deload under a time cap keeps the normal exercises
 * and only cuts sets.
 */
import seed from '../../../supabase/seed/exercises.json';
import { devLibrary, fromSeed, type SeedExercise } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { deloadSets } from '../program/block';
import { planById, planDayInput } from '../program/plans';

import { blockReason } from './filters';
import { generateSession } from './generate';
import { simulate } from './r8-sim';
import type { GeneratorInput } from './types';

const LIBRARY = devLibrary();
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 60,
  mainGoals: ['look'],
  muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');
const sets = (s: ReturnType<typeof generateSession>) => main(s).reduce((n, i) => n + i.sets, 0);

describe('spare time becomes sets (Daniel, Phase 20)', () => {
  it('more time gives more sets, the same exercises, up to the per-move cap', () => {
    const five = { ...base, exercisesPerSession: 5 };
    const [s45, s60, s90] = [45, 60, 90].map((minutes) => generateSession({ ...five, minutes }));
    for (const s of [s45, s60, s90]) expect(s.error).toBeUndefined();
    expect(main(s45).map((i) => i.exerciseId)).toEqual(main(s60).map((i) => i.exerciseId));
    expect(main(s60).map((i) => i.exerciseId)).toEqual(main(s90).map((i) => i.exerciseId));
    expect(sets(s45)).toBeLessThan(sets(s60));
    expect(sets(s60)).toBeLessThanOrEqual(sets(s90));
    // 90 min: every move at its cap; the rest is the "Add 1 exercise?" offer.
    for (const i of main(s90)) expect(i.sets).toBe(4);
  });

  it('a 60-min gym user with 5 exercises lands at 48–54 min, never over', () => {
    const s = generateSession({ ...base, exercisesPerSession: 5 });
    expect(s.estimatedMinutes).toBeGreaterThanOrEqual(48);
    expect(s.estimatedMinutes).toBeLessThanOrEqual(54);
    expect(main(s)).toHaveLength(5);
  });

  it('adults stop at 4 sets a move; teens, 60+ and joint care at 3', () => {
    expect(Math.max(...main(generateSession({ ...base, minutes: 120 })).map((i) => i.sets))).toBe(
      4,
    );
    for (const patch of [
      { mode: 'teen', band: 'teen' },
      { mode: 'senior', band: 'senior' },
      { painAreas: ['shoulder', 'knee', 'lower_back'] },
    ] as Partial<GeneratorInput>[]) {
      const s = generateSession({ ...base, ...patch, minutes: 120 });
      expect(s.error).toBeUndefined();
      for (const i of main(s)) expect(i.sets).toBeLessThanOrEqual(3);
    }
  });

  it('the list estimate is the sum of what is on the list', () => {
    const s = generateSession(base);
    const onList = Math.round(
      ((s.warmupMinutes + s.cooldownMinutes) * 60 +
        main(s).reduce((n, i) => n + i.estSeconds, 0) +
        s.items.filter((i) => i.role === 'finisher').reduce((n, i) => n + i.estSeconds, 0)) /
        60,
    );
    expect(s.estimatedMinutes).toBe(onList);
  });

  it('30 min keeps its trim: no extra sets', () => {
    const s = generateSession({ ...base, minutes: 30 });
    const plain = generateSession({ ...base, minutes: 30, noExtraSets: true });
    expect(main(s)).toEqual(main(plain));
  });
});

describe('deload under a time cap', () => {
  it('keeps the normal week’s exercises and cuts their sets', () => {
    const plan = planById('seniorSteady-fullBody-3')!;
    const senior: GeneratorInput = {
      ...base,
      mode: 'senior',
      band: 'senior',
      location: 'home',
      equipment: ['chair', 'dumbbells'],
      minutes: 30,
      mainGoals: ['strength'],
      muscleGoals: [],
    };
    const normal = generateSession({
      ...planDayInput(senior, plan, 0, LIBRARY),
      noExtraSets: true,
    });
    const deload = generateSession({ ...planDayInput(senior, plan, 0, LIBRARY), deload: true });
    expect(deload.deload).toBe(true);
    expect(main(deload).map((i) => i.exerciseId)).toEqual(main(normal).map((i) => i.exerciseId));
    main(deload).forEach((i, n) => expect(i.sets).toBe(deloadSets(main(normal)[n].sets)));
    expect(deload.estimatedMinutes).toBeLessThanOrEqual(normal.estimatedMinutes);
  });

  it('a deload has no extra sets', () => {
    const d = generateSession({ ...base, minutes: 90, deload: true });
    const plain = generateSession({ ...base, minutes: 90, noExtraSets: true });
    main(d).forEach((i, n) => expect(i.sets).toBe(deloadSets(main(plain)[n].sets)));
  });
});

describe('readiness checks every primary muscle', () => {
  const byId = new Map(LIBRARY.map((e) => [e.id, e]));
  const idOf = (slug: string) => LIBRARY.find((e) => e.slug === slug)!.id;
  const yesterday = (slug: string) => ({
    date: '2026-09-27',
    at: '2026-09-27T12:00:00Z',
    mainMuscles: byId
      .get(idOf(slug))!
      .muscles.filter((m) => m.role === 'primary')
      .map((m) => m.muscleKey),
    exerciseIds: [idOf(slug)],
  });

  it.each([
    ['dumbbell_single_leg_rdl', 'quads', 'glutes'],
    ['pull_up', 'upperBack', 'lats'],
  ])('after %s, a %s move that also works %s waits', (done, target, tired) => {
    const s = generateSession({
      ...base,
      muscleGoals: [{ muscleKey: target, goal: 'grow' }],
      exercisesPerSession: 1,
      targetsOnly: true,
      recentSessions: [yesterday(done)],
    });
    expect(s.error).toBeUndefined();
    const pick = byId.get(main(s)[0].exerciseId)!;
    const primaries = pick.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey);
    expect(primaries).not.toContain(tired);
  });
});

describe('PPL 6: the same day type varies', () => {
  it('a day repeats at most 2 moves of the last session of its type', () => {
    const sim = simulate({
      base: { ...base, exercisesPerSession: 5 },
      library: LIBRARY,
      plan: planById('muscle-ppl-6'),
      start: '2026-09-07',
      weekdays: [1, 2, 3, 4, 5, 6],
      weeks: 3,
    });
    for (let i = 3; i < sim.length; i++) {
      const same = sim[i].slugs.filter((x) => sim[i - 3].slugs.includes(x));
      expect({ date: sim[i].date, same: same.length }).toEqual({
        date: sim[i].date,
        same: expect.any(Number),
      });
      expect(same.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('high blood pressure: sibling holds are flagged too', () => {
  it.each([
    'kneeling_side_plank',
    'short_lever_copenhagen',
    'rx_short_copenhagen_hold',
    'rx_side_plank_knees',
    'dumbbell_suitcase_carry',
  ])('%s is ruled out', (slug) => {
    const e = fromSeed((seed.exercises as SeedExercise[]).find((x) => x.slug === slug)!);
    expect(
      blockReason(e, {
        ...base,
        location: e.location[0],
        equipment: e.equipment,
        position: e.positions[e.positions.length - 1],
        conditions: ['high_blood_pressure'],
        rehab: e.rehab,
      }),
    ).toBe('contraindication');
  });
});
