/**
 * QA round 2 — P1 generator fixes (docs/qa-round-2.md §2: R2-06 … R2-11)
 * and the P2 generator items.
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import type { MovementKey } from '../movement/catalog';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { blockReason, doseFor, generateSession, type GeneratorInput } from './index';
import type { RecentSession } from './types';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 40,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const gen = (patch: Partial<GeneratorInput> = {}) => generateSession({ ...base, ...patch });
const main = (s: ReturnType<typeof gen>) => s.items.filter((i) => i.role === 'main');
const primaries = (id: string) =>
  byId
    .get(id)!
    .muscles.filter((m) => m.role === 'primary')
    .map((m) => m.muscleKey);
const parent = (k: string) => muscleByKey(k)?.parentKey ?? k;

describe('R2-06 balance work survives the time fit', () => {
  it('Rosa (68, fell, with support, balance goal) keeps a balance exercise at 30 and 15 min', () => {
    for (const minutes of [30, 20, 15]) {
      const s = gen({
        mode: 'senior',
        band: 'senior',
        position: 'with_support',
        location: 'home',
        equipment: [],
        conditions: ['fell_last_year'],
        mainGoals: ['balance'],
        muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
        minutes,
      });
      expect(main(s).some((i) => byId.get(i.exerciseId)!.pattern === 'balance')).toBe(true);
    }
  });
});

describe('R2-07 restricted or painful joints get a light dose', () => {
  it('knee restriction: leg extension is 12–15, light, no ramp-up', () => {
    const s = gen({ restrictions: ['knee'] });
    for (const item of main(s)) {
      const e = byId.get(item.exerciseId)!;
      if (e.joints.some((j) => j.joint === 'knee')) {
        expect(item.reps ?? [12, 15]).toEqual([12, 15]);
        expect(item.loadHint).not.toBe('heavy');
      }
    }
    const ramp = s.items.find((i) => i.part === 'ramp_up');
    if (ramp) expect(byId.get(ramp.exerciseId)!.joints.some((j) => j.joint === 'knee')).toBe(false);
  });

  it('a painful movement is left out while the recovery plan is in phase 1', () => {
    const limit = {
      area: 'shoulder',
      joints: ['shoulder' as const],
      painful: ['shoulder.abduction'] as MovementKey[],
      painFree: ['shoulder.flexion', 'shoulder.extension'] as MovementKey[],
      score: 4,
    };
    const lateral = bySlug('leaning_lateral_raise');
    const phase1 = { ...base, movementLimits: [{ ...limit, phase: 1 as const }] };
    const phase3 = { ...base, movementLimits: [{ ...limit, phase: 3 as const }] };
    expect(blockReason(lateral, phase1)).toBe('painful_movement');
    expect(blockReason(lateral, phase3)).toBeNull();
  });
});

describe('R2-08 targets follow recovery hours', () => {
  it('60+: quads trained yesterday morning are not trained again (96 h)', () => {
    const recent: RecentSession[] = [
      { date: '2026-09-27', at: '2026-09-27T09:00:00Z', mainMuscles: ['quads'] },
    ];
    const s = gen({
      mode: 'senior',
      band: 'senior',
      muscleGoals: [
        { muscleKey: 'quads', goal: 'strengthen' },
        { muscleKey: 'upperBack', goal: 'strengthen' },
      ],
      recentSessions: recent,
    });
    expect(main(s).some((i) => i.targetMuscle === 'quads')).toBe(false);
    expect(s.notes).toContainEqual({ key: 'generator.notes.recovering', muscles: ['quads'] });
  });

  it('when everything was trained this morning: no workout, rest or mobility instead', () => {
    const everything = LIBRARY.flatMap((e) => e.muscles.map((m) => m.muscleKey));
    const s = gen({
      muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      recentSessions: [
        { date: '2026-09-28', at: '2026-09-28T08:00:00Z', mainMuscles: [...new Set(everything)] },
      ],
    });
    expect(s.error).toBe('all_recovering');
  });
});

describe('R2-09 one exercise per parent muscle; balanced weeks', () => {
  it('three chest goals give one chest exercise per session', () => {
    const s = gen({
      mainGoals: ['look'],
      muscleGoals: [
        { muscleKey: 'upperChest', goal: 'grow' },
        { muscleKey: 'midChest', goal: 'grow' },
        { muscleKey: 'lowerChest', goal: 'grow' },
      ],
    });
    const parents = main(s).map((i) => parent(primaries(i.exerciseId)[0]));
    expect(parents.filter((p) => p === 'chest')).toHaveLength(1);
    expect(new Set(parents).size).toBe(parents.length);
  });

  it('a chest-focused week stays within one session of push : pull : legs', () => {
    const recent: RecentSession[] = [];
    const counts = { push: 0, pull: 0, legs: 0 };
    const days = ['2026-09-21', '2026-09-23', '2026-09-25'];
    for (const day of days) {
      const s = gen({
        mainGoals: ['look'],
        muscleGoals: [
          { muscleKey: 'upperChest', goal: 'grow' },
          { muscleKey: 'midChest', goal: 'grow' },
          { muscleKey: 'lowerChest', goal: 'grow' },
        ],
        today: day,
        now: `${day}T12:00:00Z`,
        recentSessions: [...recent],
      });
      const muscles = [...new Set(main(s).flatMap((i) => primaries(i.exerciseId)))];
      for (const m of main(s)) {
        const g = muscleByKey(primaries(m.exerciseId)[0])?.movementGroup;
        if (g && g !== 'core') counts[g]++;
      }
      recent.unshift({ date: day, at: `${day}T12:00:00Z`, mainMuscles: muscles });
    }
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });
});

describe('R2-10 a chosen muscle is never dropped silently', () => {
  it('each chosen muscle is trained or named in a note', () => {
    const cases: Partial<GeneratorInput>[] = [
      {
        mode: 'senior',
        band: 'senior',
        position: 'seated_only',
        location: 'home',
        equipment: [],
        muscleGoals: [
          { muscleKey: 'quads', goal: 'strengthen' },
          { muscleKey: 'glutes', goal: 'strengthen' },
        ],
      },
      {
        location: 'home',
        equipment: [],
        muscleGoals: [
          { muscleKey: 'upperChest', goal: 'grow' },
          { muscleKey: 'midChest', goal: 'grow' },
          { muscleKey: 'lowerChest', goal: 'grow' },
          { muscleKey: 'quads', goal: 'grow' },
        ],
      },
    ];
    for (const patch of cases) {
      const s = gen(patch);
      const trained = new Set(main(s).map((i) => parent(i.targetMuscle ?? '')));
      const noted = new Set(s.notes.flatMap((n) => ('muscles' in n ? n.muscles.map(parent) : [])));
      for (const g of patch.muscleGoals!) {
        const p = parent(g.muscleKey);
        // Chest sub-regions rotate through the week; one of them stands for chest today.
        expect(trained.has(p) || noted.has(p)).toBe(true);
      }
    }
  });
});

describe('R2-11 kids get the game warm-ups; adults never do', () => {
  it('child warm-up is a kid game move', () => {
    const s = gen({ mode: 'child', band: 'kid', location: 'home', equipment: [] });
    const warm = s.items.find((i) => i.part === 'warmup_general')!;
    expect(byId.get(warm.exerciseId)!.slug).toMatch(/^kid_/);
  });

  it('no kid_* move for teens, adults or 60+', () => {
    for (const [mode, band] of [
      ['teen', 'teen'],
      ['adult', 'adult'],
      ['senior', 'elder'],
    ] as const) {
      const s = gen({ mode, band, location: 'home', equipment: [] });
      for (const item of s.items) expect(byId.get(item.exerciseId)!.slug).not.toMatch(/^kid_/);
    }
  });
});

describe('P2 generator items', () => {
  it('the same move never appears twice in one session (ramp-up aside)', () => {
    for (const goal of ['look', 'lose_weight', 'fitness'] as const) {
      const s = gen({ mainGoals: [goal], location: 'home', equipment: [] });
      const ids = s.items.filter((i) => i.part !== 'ramp_up').map((i) => i.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('the ramp-up is for the first main exercise', () => {
    const s = gen({ muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }] });
    const ramp = s.items.find((i) => i.part === 'ramp_up');
    if (ramp) expect(ramp.exerciseId).toBe(main(s)[0].exerciseId);
  });

  it('isolation moves are never dosed as heavy strength', () => {
    for (const slug of ['cable_fly', 'barbell_curl', 'dumbbell_lateral_raise']) {
      const e = LIBRARY.find((x) => x.slug === slug);
      if (!e) continue;
      expect(doseFor('strengthen', 'adult', e, 4).loadHint).not.toBe('heavy');
    }
  });

  it('rotates among the best options week to week', () => {
    const picks = new Set(
      ['2026-09-07', '2026-09-14', '2026-09-21'].map(
        (today) => main(gen({ today, now: `${today}T12:00:00Z` }))[0]?.exerciseId,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
