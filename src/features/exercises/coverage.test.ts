/**
 * Library coverage (QA round 1, O-3): enough safe variety for every muscle,
 * equipment level, position and role, so swaps have options and no profile
 * is left without a workout. Cells that can't reach the target are listed
 * with the reason.
 */
import catalogJson from '../../../supabase/seed/joint_movements.json';

import { generateSession, getAlternatives } from '../generator';
import type { GeneratorInput } from '../generator/types';
import type { MovementCatalog } from '../movement/catalog';
import { MUSCLES, muscleByKey } from '../muscles';

import { devLibrary } from './library';
import type { Exercise } from './types';

const LIBRARY = devLibrary();
const CATALOG = catalogJson as unknown as MovementCatalog;
const MIN = 5;

const LEVELS = {
  none: [] as string[],
  bands: ['bands'],
  dumbbells: ['bands', 'dumbbells', 'bench'],
  gym: [
    'bands',
    'dumbbells',
    'bench',
    'barbell',
    'kettlebell',
    'machines',
    'cables',
    'pull_up_bar',
    'mat',
  ],
};
const fits = (e: Exercise, level: keyof typeof LEVELS) =>
  e.equipment.every((q) => LEVELS[level].includes(q)) &&
  e.location.includes(level === 'gym' ? 'gym' : 'home');
const primary = (e: Exercise, m: string) =>
  e.muscles.some((x) => x.muscleKey === m && x.role === 'primary');
const regular = LIBRARY.filter((e) => !e.rehab);

const GOAL_MUSCLES = MUSCLES.filter((m) => m.views.length).map((m) => m.key);

describe('library coverage (QA O-3)', () => {
  it('has roughly 250 or more exercises', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(250);
  });

  it.each(Object.keys(LEVELS) as (keyof typeof LEVELS)[])(
    'every muscle has ≥ 5 main options at the "%s" equipment level',
    (level) => {
      const short = GOAL_MUSCLES.map((m) => ({
        m,
        n: regular.filter((e) => e.parts.includes('main') && primary(e, m) && fits(e, level))
          .length,
      })).filter((c) => c.n < MIN);
      expect(short).toEqual([]);
    },
  );

  it.each(['upper', 'core', 'lower'] as const)(
    'seated and supported people have ≥ 5 main options for the %s body (bodyweight or bands)',
    (region) => {
      for (const position of ['seated_only', 'with_support'] as const) {
        const n = regular.filter(
          (e) =>
            e.parts.includes('main') &&
            e.positions.includes(position) &&
            fits(e, 'bands') &&
            e.muscles.some(
              (m) => m.role === 'primary' && muscleByKey(m.muscleKey)?.region === region,
            ),
        ).length;
        expect({ position, region, n: Math.min(n, MIN) }).toEqual({ position, region, n: MIN });
      }
    },
  );

  const warmups = regular.filter((e) => e.parts.some((p) => p.startsWith('warmup')));
  const regionOf = (e: Exercise) =>
    new Set(
      e.muscles.filter((m) => m.role === 'primary').map((m) => muscleByKey(m.muscleKey)?.region),
    );

  it('warm-ups: ≥ 10 upper, lower, full body and seated', () => {
    const upper = warmups.filter((e) => regionOf(e).has('upper')).length;
    const lower = warmups.filter((e) => regionOf(e).has('lower')).length;
    const full = warmups.filter((e) => e.pattern === 'cardio' || regionOf(e).size > 1).length;
    const seated = warmups.filter((e) => e.positions.includes('seated_only')).length;
    expect({ upper, lower, full, seated }).toEqual({
      upper: Math.max(upper, 10),
      lower: Math.max(lower, 10),
      full: Math.max(full, 10),
      seated: Math.max(seated, 10),
    });
  });

  it('cool-down: ≥ 3 static stretches for every muscle group', () => {
    const stretches = regular.filter((e) => e.parts.includes('cooldown_stretch'));
    const groups: Record<string, string[]> = {
      chest: ['chest', 'upperChest', 'midChest', 'lowerChest'],
      shoulders: ['shoulders', 'rearDelts'],
      back: ['upperBack', 'lats'],
      neck: ['traps'],
      biceps: ['biceps'],
      triceps: ['triceps'],
      forearms: ['forearms'],
      core: ['abs', 'upperAbs', 'lowerAbs', 'obliques'],
      lowerBack: ['lowerBack'],
      glutes: ['glutes'],
      hips: ['hips'],
      adductors: ['adductors'],
      quads: ['quads'],
      hamstrings: ['hamstrings'],
      calves: ['calves'],
      shins: ['shins'],
    };
    const short = Object.entries(groups)
      .map(([g, keys]) => ({
        g,
        n: stretches.filter((e) => keys.some((k) => primary(e, k))).length,
      }))
      .filter((c) => c.n < 3);
    expect(short).toEqual([]);
  });

  it('balance and fall prevention: ≥ 10, with seated and supported ones', () => {
    const balance = regular.filter((e) => e.pattern === 'balance' && e.parts.includes('main'));
    expect(balance.length).toBeGreaterThanOrEqual(10);
    expect(
      balance.filter((e) => e.positions.includes('seated_only')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      balance.filter((e) => e.positions.includes('with_support')).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('kids have game-like warm-ups', () => {
    const kid = warmups.filter((e) => e.minAgeBand === 'kid' && e.slug.startsWith('kid_'));
    expect(kid.length).toBeGreaterThanOrEqual(5);
  });

  // A hold without movement is not meaningful for these (documented, QA O-3).
  const NO_HOLD = new Set([
    'lower_back.lift',
    'knee.stairs',
    'knee.pivot',
    'knee.impact',
    'ankle.impact',
  ]);

  it('Repair: ≥ 3 holds (phase 1) for every joint movement where a hold makes sense', () => {
    const short: string[] = [];
    for (const [joint, entry] of Object.entries(CATALOG.joints)) {
      for (const movement of entry.movements) {
        const key = `${joint}.${movement}`;
        if (NO_HOLD.has(key)) continue;
        const n = LIBRARY.filter((e) =>
          e.joints.some(
            (j) => j.joint === joint && j.movement === movement && j.range === 'isometric',
          ),
        ).length;
        if (n < 3) short.push(`${key}: ${n}`);
      }
    }
    expect(short).toEqual([]);
  });

  it('Repair: ≥ 2 pain-free-range strengthening moves (phase 2) for every joint', () => {
    const short = Object.keys(CATALOG.joints).filter(
      (joint) =>
        LIBRARY.filter(
          (e) =>
            e.parts.includes('main') &&
            e.joints.some((j) => j.joint === joint && j.range === 'partial'),
        ).length < 2,
    );
    expect(short).toEqual([]);
  });

  it('the shoulder set includes the rotator cuff', () => {
    expect(LIBRARY.filter((e) => primary(e, 'rotatorCuff')).length).toBeGreaterThanOrEqual(5);
  });
});

describe('swap options (QA O-3: arm circles had none)', () => {
  const profiles: Partial<GeneratorInput>[] = [
    { location: 'home', equipment: [], position: 'standing' },
    { location: 'home', equipment: ['bands'], position: 'with_support' },
    { location: 'home', equipment: [], position: 'seated_only', mode: 'senior', band: 'senior' },
    { location: 'gym', equipment: LEVELS.gym as GeneratorInput['equipment'], position: 'standing' },
  ];
  const base: GeneratorInput = {
    library: LIBRARY,
    includeDrafts: true,
    mode: 'adult',
    band: 'adult',
    position: 'standing',
    location: 'gym',
    equipment: [],
    minutes: 45,
    mainGoals: ['look'],
    muscleGoals: [
      { muscleKey: 'upperChest', goal: 'grow' },
      { muscleKey: 'glutes', goal: 'grow' },
    ],
    exercisesPerSession: 3,
    setsPerExercise: 3,
    painAreas: [],
    conditions: [],
    restrictions: [],
  };

  it.each(profiles.map((p, i) => [i, p] as const))(
    'profile %i: every item has swap options',
    (_i, p) => {
      const input = { ...base, ...p };
      const s = generateSession(input);
      expect(s.error).toBeUndefined();
      const thin = s.items
        .filter((i) => i.part !== 'ramp_up')
        .map((i) => ({ slug: i.exerciseId, n: getAlternatives(s, i.id, input).length }))
        .filter((x) => x.n < 3);
      expect(thin).toEqual([]);
    },
  );
});
