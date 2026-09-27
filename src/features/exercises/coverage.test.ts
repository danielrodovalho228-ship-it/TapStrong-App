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
import { resources } from '@/i18n';

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
const POSITIONS = ['standing', 'with_support', 'seated_only'] as const;

describe('library coverage (QA O-3)', () => {
  it('has roughly 250 or more exercises', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(250);
  });

  // Every muscle × equipment level × position cell (QA round 2: the old
  // check ignored position, so seated bodyweight glutes had 0).
  it.each(Object.keys(LEVELS) as (keyof typeof LEVELS)[])(
    'every muscle has ≥ 5 main options at the "%s" level, standing, supported and seated',
    (level) => {
      const short = GOAL_MUSCLES.flatMap((m) =>
        POSITIONS.map((position) => ({
          cell: `${m} · ${position}`,
          n: regular.filter(
            (e) =>
              e.parts.includes('main') &&
              primary(e, m) &&
              fits(e, level) &&
              e.positions.includes(position),
          ).length,
        })),
      ).filter((c) => c.n < MIN);
      expect(short).toEqual([]);
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

  it('cool-down: ≥ 3 static stretches for every muscle group, in every position', () => {
    const stretches = regular.filter((e) => e.parts.includes('cooldown_stretch'));
    const groups: Record<string, string[]> = {
      chest: ['chest', 'upperChest', 'midChest', 'lowerChest'],
      shoulders: ['shoulders'],
      rearDelts: ['rearDelts'],
      rotatorCuff: ['rotatorCuff'],
      upperBack: ['upperBack'],
      lats: ['lats'],
      neck: ['traps'],
      biceps: ['biceps'],
      triceps: ['triceps'],
      forearms: ['forearms'],
      core: ['abs', 'upperAbs', 'lowerAbs'],
      obliques: ['obliques'],
      lowerBack: ['lowerBack'],
      glutes: ['glutes'],
      hips: ['hips'],
      adductors: ['adductors'],
      quads: ['quads'],
      knees: ['knees'],
      hamstrings: ['hamstrings'],
      calves: ['calves'],
      shins: ['shins'],
    };
    const short = Object.entries(groups)
      .flatMap(([g, keys]) =>
        POSITIONS.map((position) => ({
          cell: `${g} · ${position}`,
          n: stretches.filter(
            (e) => keys.some((k) => primary(e, k)) && e.positions.includes(position),
          ).length,
        })),
      )
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

  // Decision 2 (QA round 2): every joint movement has ≥ 3 moves in phase 2
  // (pain-free / shorter range) and phase 3 (progressive load, full range).
  const movements = Object.entries(CATALOG.joints).flatMap(([joint, entry]) =>
    entry.movements.map((movement) => ({ joint, movement, key: `${joint}.${movement}` })),
  );
  const uses = (e: Exercise, joint: string, movement: string, range: string) =>
    e.joints.some((j) => j.joint === joint && j.movement === movement && j.range === range);

  it('Repair: ≥ 3 pain-free-range moves (phase 2) for every joint movement', () => {
    const short = movements
      .map(({ joint, movement, key }) => ({
        key,
        n: LIBRARY.filter(
          (e) =>
            e.parts.includes('main') &&
            (uses(e, joint, movement, 'partial') ||
              e.rangeLimit.includes(key as Exercise['rangeLimit'][number])),
        ).length,
      }))
      .filter((c) => c.n < 3);
    expect(short).toEqual([]);
  });

  it('Repair: ≥ 3 progressive-loading moves (phase 3) for every joint movement', () => {
    const short = movements
      .map(({ joint, movement, key }) => ({
        key,
        n: LIBRARY.filter(
          (e) =>
            e.parts.includes('main') &&
            uses(e, joint, movement, 'full') &&
            (e.loaded || e.equipment.includes('bands') || e.level >= 2),
        ).length,
      }))
      .filter((c) => c.n < 3);
    expect(short).toEqual([]);
  });

  it('every main exercise lists its contraindications (QA round 2)', () => {
    expect(
      LIBRARY.filter((e) => e.parts.includes('main') && !e.contraindications.length).map(
        (e) => e.slug,
      ),
    ).toEqual([]);
    const press = LIBRARY.find((e) => e.slug === 'neutral_grip_machine_chest_press')!;
    expect(press.contraindications).toContain('shoulder');
  });

  it.each(['en', 'es', 'pt-BR'] as const)('every exercise name is unique in %s', (locale) => {
    const names = LIBRARY.map((e) =>
      (resources[locale].translation.exercises as Record<string, { name: string }>)[
        e.slug
      ].name.toLowerCase(),
    );
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
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
    // Seated and supported people (QA round 2: seated knee extension had 0).
    {
      location: 'home',
      equipment: ['bands'],
      position: 'seated_only',
      mode: 'senior',
      band: 'senior',
    },
    { location: 'home', equipment: [], position: 'with_support', mode: 'senior', band: 'senior' },
    {
      location: 'gym',
      equipment: LEVELS.gym as GeneratorInput['equipment'],
      position: 'seated_only',
    },
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
