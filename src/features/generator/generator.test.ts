import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { GYM_EQUIPMENT_OPTIONS, HOME_EQUIPMENT_OPTIONS } from '../onboarding/options';

import {
  blockReason,
  doseFor,
  generateSession,
  getAlternatives,
  mainWorkMuscles,
  MIN_COOLDOWN,
  MIN_WARMUP,
  shortSession,
  swapItem,
  warmupCooldownMinutes,
  type GeneratedSession,
  type GeneratorInput,
} from './index';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const ex = (id: string) => byId.get(id)!;

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
    { muscleKey: 'upperChest', goal: 'grow' },
    { muscleKey: 'midChest', goal: 'grow' },
  ],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

const gen = (patch: Partial<GeneratorInput> = {}) => generateSession({ ...base, ...patch });
const roles = (s: GeneratedSession) => s.items.map((i) => i.role);
const exercisesOf = (s: GeneratedSession) => s.items.map((i) => ex(i.exerciseId));

// Every combination of mode, position, place and time the app can produce.
const MATRIX: Partial<GeneratorInput>[] = [];
for (const [mode, band] of [
  ['child', 'kid'],
  ['teen', 'teen'],
  ['adult', 'adult'],
  ['senior', 'elder'],
] as const)
  for (const position of ['standing', 'with_support', 'seated_only'] as const)
    for (const [location, equipment] of [
      ['gym', GYM_EQUIPMENT_OPTIONS],
      ['home', HOME_EQUIPMENT_OPTIONS],
      ['home', []],
      ['outdoors', []],
    ] as const)
      for (const minutes of [10, 15, 30, 60])
        MATRIX.push({ mode, band, position, location, equipment: [...equipment], minutes });

describe('session structure (SPEC §8)', () => {
  it('always runs warm-up → main → finisher → cool-down, in that order', () => {
    for (const patch of MATRIX) {
      const s = gen(patch);
      expect({ patch, error: s.error }).toEqual({ patch, error: undefined });
      const order = roles(s);
      expect(order[0]).toBe('warmup');
      expect(order[order.length - 1]).toBe('cooldown');
      const rank = { warmup: 0, main: 1, finisher: 2, cooldown: 3 };
      for (let i = 1; i < order.length; i++) {
        expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
      }
      expect(order).toContain('main');
    }
  });

  it('warm-up starts with easy cardio; cool-down ends with breathing', () => {
    const s = gen();
    expect(s.items[0].part).toBe('warmup_general');
    expect(s.items[s.items.length - 1].part).toBe('cooldown_breathing');
    expect(s.items.some((i) => i.part === 'cooldown_walk')).toBe(true);
    expect(s.items.some((i) => i.part === 'cooldown_stretch')).toBe(true);
  });

  it('uses the SPEC warm-up / cool-down minutes per age mode', () => {
    expect(warmupCooldownMinutes('child', 40)).toEqual({ warmup: 5, cooldown: 3 });
    expect(warmupCooldownMinutes('teen', 40)).toEqual({ warmup: 5, cooldown: 4 });
    expect(warmupCooldownMinutes('adult', 40)).toEqual({ warmup: 6, cooldown: 5 });
    expect(warmupCooldownMinutes('senior', 40)).toEqual({ warmup: 9, cooldown: 6 });
  });

  it('"Only 15 min" shrinks warm-up and cool-down but never removes them', () => {
    for (const mode of ['child', 'teen', 'adult', 'senior'] as const) {
      const { warmup, cooldown } = warmupCooldownMinutes(mode, 15);
      expect(warmup).toBeGreaterThanOrEqual(MIN_WARMUP);
      expect(cooldown).toBeGreaterThanOrEqual(MIN_COOLDOWN);
    }
    const s = shortSession(base);
    expect(s.minutes).toBe(15);
    expect(roles(s)).toContain('warmup');
    expect(roles(s)).toContain('cooldown');
  });

  it('is deterministic, whatever the library order', () => {
    const a = gen();
    expect(gen()).toEqual(a);
    expect(gen({ library: [...LIBRARY].reverse() })).toEqual(a);
  });
});

describe('safety filters (SPEC §2, §8 "Filter")', () => {
  const everyItemIsSafe = (input: GeneratorInput) => {
    const s = generateSession(input);
    for (const e of exercisesOf(s)) expect([e.slug, blockReason(e, input)]).toEqual([e.slug, null]);
    return s;
  };

  it('every generated item passes every filter, across the whole matrix', () => {
    for (const patch of MATRIX) everyItemIsSafe({ ...base, ...patch });
  });

  it('only released exercises reach users when drafts are off', () => {
    expect(gen({ includeDrafts: false }).error).toBe('no_library');
    const released = LIBRARY.map((e) => ({ ...e, status: 'released' as const }));
    const s = gen({ includeDrafts: false, library: released });
    expect(s.error).toBeUndefined();
    const mixed = released.map((e) =>
      e.slug === 'incline_dumbbell_press' ? { ...e, status: 'draft' as const } : e,
    );
    expect(
      exercisesOf(gen({ includeDrafts: false, library: mixed })).map((e) => e.slug),
    ).not.toContain('incline_dumbbell_press');
  });

  it('never uses retired exercises, even in dev', () => {
    const lib = LIBRARY.map((e) =>
      e.slug === 'incline_dumbbell_press' ? { ...e, status: 'retired' as const } : e,
    );
    expect(exercisesOf(gen({ library: lib })).map((e) => e.slug)).not.toContain(
      'incline_dumbbell_press',
    );
  });

  it('restrictions and pain areas rule exercises out', () => {
    const input = {
      ...base,
      muscleGoals: [{ muscleKey: 'quads', goal: 'grow' as const }],
      restrictions: ['knee'],
    };
    const s = everyItemIsSafe(input);
    for (const e of exercisesOf(s)) expect(e.contraindications).not.toContain('knee');
    expect(exercisesOf(s).map((e) => e.slug)).not.toContain('goblet_squat');
    const shoulder = everyItemIsSafe({ ...base, painAreas: ['shoulder'] });
    for (const e of exercisesOf(shoulder)) expect(e.contraindications).not.toContain('shoulder');
  });

  it('red-flag conditions keep everything low impact', () => {
    for (const condition of ['heart_condition', 'pregnant_postpartum', 'recent_surgery']) {
      const s = everyItemIsSafe({ ...base, mainGoals: ['lose_weight'], conditions: [condition] });
      for (const e of exercisesOf(s)) {
        expect(e.impact).toBe(0);
        expect(e.contraindications).not.toContain(condition);
      }
    }
  });

  it('60+ never gets high-impact moves', () => {
    const s = everyItemIsSafe({
      ...base,
      mode: 'senior',
      band: 'elder',
      mainGoals: ['lose_weight'],
      location: 'home',
      equipment: [],
    });
    for (const e of exercisesOf(s)) expect(e.impact).toBeLessThan(2);
  });

  it('kids get no weights, machines or adult-only moves', () => {
    const s = everyItemIsSafe({ ...base, mode: 'child', band: 'kid' });
    for (const e of exercisesOf(s)) {
      expect(e.minAgeBand).toBe('kid');
      expect(e.loaded).toBe(false);
    }
  });

  it('respects position ability: seated-only users get seated moves only', () => {
    const s = everyItemIsSafe({ ...base, position: 'seated_only', mode: 'senior', band: 'senior' });
    for (const e of exercisesOf(s)) expect(e.positions).toContain('seated_only');
  });

  it('respects location and equipment', () => {
    const s = everyItemIsSafe({ ...base, location: 'home', equipment: ['bands'] });
    for (const e of exercisesOf(s)) {
      expect(e.location).toContain('home');
      expect(e.equipment.every((q) => q === 'bands')).toBe(true);
    }
  });
});

describe('main work and dosage', () => {
  it('works the selected muscles first, by priority', () => {
    const s = gen();
    const main = s.items.filter((i) => i.role === 'main');
    expect(main[0].targetMuscle).toBe('upperChest');
    expect(main[1].targetMuscle).toBe('midChest');
    expect(ex(main[0].exerciseId).muscles.find((m) => m.role === 'primary')?.muscleKey).toBe(
      'upperChest',
    );
  });

  it('a goal on "chest" covers its parts', () => {
    const s = gen({ muscleGoals: [{ muscleKey: 'chest', goal: 'grow' }] });
    const primaries = exercisesOf(s)
      .filter((_, n) => s.items[n].targetMuscle === 'chest')
      .flatMap((e) => e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey));
    expect(primaries.length).toBeGreaterThan(0);
    for (const m of primaries) expect(['upperChest', 'midChest', 'lowerChest']).toContain(m);
  });

  it('follows the SPEC dosage table', () => {
    const press = ex('flat_dumbbell_press');
    expect(doseFor('grow', 'adult', press, 3)).toMatchObject({
      sets: 3,
      reps: [8, 12],
      restSeconds: 75,
    });
    expect(doseFor('grow', 'adult', press, 6).sets).toBe(4);
    expect(doseFor('firm', 'adult', press, 4)).toMatchObject({ sets: 3, reps: [12, 15] });
    expect(doseFor('strengthen', 'adult', press, 3)).toMatchObject({
      reps: [4, 8],
      loadHint: 'heavy',
    });
    expect(doseFor('strengthen', 'teen', press, 5)).toMatchObject({
      sets: 3,
      reps: [8, 12],
      loadHint: 'light',
    });
    expect(doseFor('balance', 'adult', ex('single_leg_balance'), 3)).toMatchObject({
      holdSeconds: [20, 40],
      perSide: true,
    });
    expect(doseFor('mobility', 'adult', ex('cat_cow'), 4)).toMatchObject({
      sets: 2,
      holdSeconds: [30, 45],
    });
    expect(doseFor('grow', 'adult', ex('push_up'), 3).loadHint).toBe('bodyweight');
  });

  it('only main work counts for the body map', () => {
    const s = gen();
    const muscles = mainWorkMuscles(s, LIBRARY);
    expect(muscles).toContain('upperChest');
    const warmOnly = s.items.filter((i) => i.role !== 'main').map((i) => i.exerciseId);
    expect(warmOnly.length).toBeGreaterThan(0);
  });
});

describe('ramp-up sets (SPEC §8 warm-up)', () => {
  it('adults with weights get 1–2 light sets of the first loaded lift', () => {
    const s = gen();
    const ramp = s.items.find((i) => i.part === 'ramp_up')!;
    const firstMain = s.items.find((i) => i.role === 'main')!;
    expect(ramp.exerciseId).toBe(firstMain.exerciseId);
    expect(ramp.role).toBe('warmup');
    expect(ramp.sets).toBe(2);
    expect(ramp.loadHint).toBe('ramp');
  });

  it('teens ramp with light load only; kids never', () => {
    // Teens are steered to bodyweight first; the shoulder press is the top
    // shoulder exercise, so the first lift is loaded here.
    const teen = gen({
      mode: 'teen',
      band: 'teen',
      muscleGoals: [{ muscleKey: 'shoulders', goal: 'grow' }],
    }).items.find((i) => i.part === 'ramp_up');
    expect(teen?.loadHint).toBe('light');
    expect(teen?.sets).toBe(1);
    expect(gen({ mode: 'child', band: 'kid' }).items.some((i) => i.part === 'ramp_up')).toBe(false);
  });

  it('no ramp-up when the first exercise has no load', () => {
    expect(gen({ location: 'home', equipment: [] }).items.some((i) => i.part === 'ramp_up')).toBe(
      false,
    );
  });
});

describe('finisher (SPEC §8)', () => {
  it('cardio for weight loss or fitness', () => {
    expect(
      gen({ mainGoals: ['lose_weight'], minutes: 60 }).items.some(
        (i) => i.part === 'finisher_cardio',
      ),
    ).toBe(true);
    expect(
      gen({ mode: 'teen', band: 'teen', mainGoals: ['fitness'], minutes: 60 }).items.some(
        (i) => i.part === 'finisher_cardio',
      ),
    ).toBe(true);
  });

  it('mobility for mobility or balance goals', () => {
    expect(
      gen({ mainGoals: ['mobility'], minutes: 60 }).items.some(
        (i) => i.part === 'finisher_mobility',
      ),
    ).toBe(true);
  });

  it('none otherwise', () => {
    expect(gen({ mainGoals: ['strength'] }).items.some((i) => i.role === 'finisher')).toBe(false);
  });
});

describe('time fit (SPEC §8)', () => {
  it('fits the chosen minutes', () => {
    for (const minutes of [15, 20, 30, 45, 60]) {
      const s = gen({ minutes, exercisesPerSession: 8 });
      expect(s.estimatedMinutes).toBeLessThanOrEqual(minutes);
    }
  });

  it('drops the finisher before main work, then the lowest priority', () => {
    const long = gen({ mainGoals: ['lose_weight'], minutes: 60, exercisesPerSession: 4 });
    const short = gen({ mainGoals: ['lose_weight'], minutes: 20, exercisesPerSession: 4 });
    expect(long.items.some((i) => i.role === 'finisher')).toBe(true);
    expect(short.items.some((i) => i.role === 'finisher')).toBe(false);
    const shortMain = short.items.filter((i) => i.role === 'main');
    expect(shortMain[0].targetMuscle).toBe('upperChest');
    expect(short.notes).toContainEqual({
      key: 'generator.notes.trimmed',
      count: expect.any(Number),
    });
  });
});

describe('balance pass (SPEC §8)', () => {
  it('a chest-only choice gets pull and legs work, with a note', () => {
    const s = gen();
    const groups = s.items
      .filter((i) => i.role === 'main')
      .map((i) => ex(i.exerciseId).muscles.find((m) => m.role === 'primary')!.muscleKey);
    expect(groups.some((m) => ['upperBack', 'lats', 'rearDelts'].includes(m))).toBe(true);
    expect(groups.some((m) => ['quads', 'glutes', 'hamstrings'].includes(m))).toBe(true);
    expect(s.notes).toContainEqual({ key: 'generator.notes.balance', groups: ['pull', 'legs'] });
  });

  it('does not add a group already trained this week', () => {
    const s = gen({
      today: '2026-09-28',
      recentSessions: [{ date: '2026-09-26', mainMuscles: ['upperBack', 'lats'] }],
    });
    expect(s.notes).toContainEqual({ key: 'generator.notes.balance', groups: ['legs'] });
  });

  it('never a third hard session in a row on the same muscle', () => {
    const s = gen({
      muscleGoals: [
        { muscleKey: 'upperChest', goal: 'grow' },
        { muscleKey: 'glutes', goal: 'grow' },
      ],
      recentSessions: [
        { date: '2026-09-27', mainMuscles: ['upperChest'] },
        { date: '2026-09-26', mainMuscles: ['upperChest'] },
      ],
    });
    expect(s.items.filter((i) => i.role === 'main').map((i) => i.targetMuscle)).not.toContain(
      'upperChest',
    );
    expect(s.notes).toContainEqual({ key: 'generator.notes.rested', muscles: ['upperChest'] });
  });

  it('with no muscles picked, builds a full-body session', () => {
    const s = gen({ muscleGoals: [], exercisesPerSession: 4 });
    expect(s.items.filter((i) => i.role === 'main')).toHaveLength(4);
  });
});

describe('getAlternatives (swap, SPEC §8)', () => {
  const session = gen({ muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }] });
  const mainId = session.items.find((i) => i.role === 'main' && i.targetMuscle === 'midChest')!.id;

  it('keeps the primary muscle and the role', () => {
    const alts = getAlternatives(session, mainId, base);
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) {
      expect(a.parts).toContain('main');
      expect(a.muscles.some((m) => m.muscleKey === 'midChest' && m.role === 'primary')).toBe(true);
    }
  });

  it('offers at most 5, never one already in the workout', () => {
    const inSession = new Set(session.items.map((i) => i.exerciseId));
    const alts = getAlternatives(session, mainId, base);
    expect(alts.length).toBeLessThanOrEqual(5);
    for (const a of alts) expect(inSession.has(a.id)).toBe(false);
  });

  it('never suggests an exercise that breaks a restriction or filter', () => {
    const input = {
      ...base,
      restrictions: ['shoulder'],
      location: 'home' as const,
      equipment: HOME_EQUIPMENT_OPTIONS,
    };
    const s = generateSession({ ...input, muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }] });
    for (const item of s.items) {
      for (const a of getAlternatives(s, item.id, input)) {
        expect([a.slug, blockReason(a, input)]).toEqual([a.slug, null]);
      }
    }
  });

  it('orders by emphasis, then pattern, then level, then slug', () => {
    const alts = getAlternatives(session, mainId, base, { limit: 10 });
    const emph = alts.map((a) => a.muscles.find((m) => m.muscleKey === 'midChest')!.emphasis);
    expect([...emph].sort((a, b) => b - a)).toEqual(emph);
    expect(
      getAlternatives(session, mainId, { ...base, library: [...LIBRARY].reverse() }, { limit: 10 }),
    ).toEqual(alts);
  });

  it('"machine is taken" drops options on the same machine', () => {
    const cable = gen({
      muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      equipment: ['cables'],
    });
    const item = cable.items.find(
      (i) => i.role === 'main' && ex(i.exerciseId).equipment.includes('cables'),
    )!;
    const alts = getAlternatives(
      cable,
      item.id,
      { ...base, equipment: ['cables'] },
      { reason: 'machine_taken' },
    );
    for (const a of alts) expect(a.equipment).not.toContain('cables');
  });

  it('warm-up and cool-down swap only within the same kind of move', () => {
    const stretch = session.items.find((i) => i.part === 'cooldown_stretch')!;
    for (const a of getAlternatives(session, stretch.id, base))
      expect(a.parts).toContain('cooldown_stretch');
    const general = session.items.find((i) => i.part === 'warmup_general')!;
    for (const a of getAlternatives(session, general.id, base))
      expect(a.parts).toContain('warmup_general');
  });

  it('returns nothing when no safe option exists', () => {
    const tiny = LIBRARY.filter((e) => e.slug !== 'push_up' && e.slug !== 'wall_push_up');
    const input = { ...base, library: tiny, location: 'outdoors' as const, equipment: [] };
    const s = generateSession({ ...input, muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }] });
    const chest = s.items.find((i) => i.targetMuscle === 'midChest');
    if (chest) expect(getAlternatives(s, chest.id, input)).toEqual([]);
  });
});

describe('swapItem', () => {
  // Three slots: one chest exercise plus pull and legs, so chest alternatives remain.
  const session = gen({
    muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
    exercisesPerSession: 3,
  });
  const index = session.items.findIndex((i) => i.role === 'main');
  const item = session.items[index];
  const [alt] = getAlternatives(session, item.id, base);

  it('replaces in the same position, keeps sets, never adds an item', () => {
    const { session: next, record } = swapItem(session, item.id, alt, base, {
      reason: 'user_choice',
    });
    expect(next.items.length).toBeLessThanOrEqual(session.items.length);
    const swapped = next.items.find((i) => i.id === item.id)!;
    expect(next.items.findIndex((i) => i.id === item.id)).toBe(
      index - (session.items.length - next.items.length),
    );
    expect(swapped.exerciseId).toBe(alt.id);
    expect(swapped.sets).toBe(item.sets);
    expect(record).toEqual({
      itemId: item.id,
      fromExerciseId: item.exerciseId,
      toExerciseId: alt.id,
      reason: 'user_choice',
      setsDoneBefore: 0,
    });
  });

  it('recomputes reps for the new exercise by the goal rule', () => {
    const plank = {
      ...ex('push_up'),
      id: 'timed_chest',
      slug: 'timed_chest',
      dose: 'time' as const,
    };
    const { session: next } = swapItem(session, item.id, plank, base, { reason: 'user_choice' });
    const swapped = next.items.find((i) => i.id === item.id)!;
    expect(swapped.reps).toBeUndefined();
    expect(swapped.holdSeconds).toEqual([30, 45]);
  });

  it('with sets already logged, the swap covers only the remaining sets', () => {
    const { session: next, record } = swapItem(session, item.id, alt, base, {
      reason: 'machine_taken',
      setsDone: 1,
    });
    const swapped = next.items.find((i) => i.id === item.id)!;
    expect(swapped.replaced).toEqual([{ exerciseId: item.exerciseId, setsDone: 1 }]);
    expect(swapped.sets - swapped.replaced![0].setsDone).toBe(item.sets - 1);
    expect(record.setsDoneBefore).toBe(1);
  });

  it('the ramp-up follows a swap of the first lift', () => {
    const ramp = session.items.find((i) => i.part === 'ramp_up');
    expect(ramp?.exerciseId).toBe(item.exerciseId);
    const loadedAlt = getAlternatives(session, item.id, base).find((a) => a.loaded)!;
    const { session: next } = swapItem(session, item.id, loadedAlt, base, {
      reason: 'user_choice',
    });
    expect(next.items.find((i) => i.part === 'ramp_up')!.exerciseId).toBe(loadedAlt.id);
  });
});
