/**
 * QA round 3 (P2) — generator: isolation dosing, the filler (rest note,
 * rotation, filling to time, push/pull balance), no bodyweight for a gym
 * "Get stronger" adult, named trimmed muscles, and the tag fixes.
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import type { MovementKey } from '../movement/catalog';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import {
  blockReason,
  doseFor,
  generateSession,
  offersOneMore,
  withOneMoreExercise,
  type GeneratorInput,
} from './index';
import type { RecentSession } from './types';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = (slug: string) => byId.get(slug)!;

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
  muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');
const group = (id: string) => {
  const top = byId.get(id)!.muscles.find((m) => m.role === 'primary')!.muscleKey;
  return muscleByKey(muscleByKey(top)?.parentKey ?? top)?.movementGroup;
};

describe('isolation moves are never dosed heavy', () => {
  it.each(['dumbbell_fly', 'cable_face_pull', 'dumbbell_pullover', 'dumbbell_reverse_fly'])(
    '%s: 10–15, moderate, no heavy sets',
    (slug) => {
      const e = bySlug(slug);
      expect(e.isolation).toBe(true);
      for (const goal of ['strengthen', 'grow'] as const) {
        const d = doseFor(goal, 'adult', e, 4);
        expect(d.reps).toEqual([10, 15]);
        expect(d.loadHint).not.toBe('heavy');
        expect(d.restSeconds).toBeLessThan(120);
      }
    },
  );

  it('a real compound lift is still dosed heavy for strength', () => {
    expect(doseFor('strengthen', 'adult', bySlug('barbell_bench_press'), 4).loadHint).toBe('heavy');
  });

  it('no ramp-up on an isolation move', () => {
    for (const day of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) {
      const s = generateSession({ ...base, today: day, now: `${day}T12:00:00Z` });
      const ramp = s.items.find((i) => i.part === 'ramp_up');
      if (ramp) expect(bySlug(ramp.exerciseId).isolation).toBeFalsy();
    }
  });
});

describe('the filler', () => {
  it('keeps the number of exercises chosen and offers one more when time is left', () => {
    const input = { ...base, minutes: 60, exercisesPerSession: 3 };
    const s = generateSession(input);
    expect(main(s)).toHaveLength(3);
    expect(offersOneMore(s)).toBe(true);
    const more = withOneMoreExercise(input, s)!;
    expect(main(more)).toHaveLength(4);
    // The first three stay the same: the person only adds one.
    expect(
      main(more)
        .slice(0, 3)
        .map((i) => i.exerciseId),
    ).toEqual(expect.arrayContaining(main(s).map((i) => i.exerciseId)));
    expect(more.estimatedMinutes).toBeLessThanOrEqual(60);
  });

  it('keeps push and pull within one exercise of each other, day after day', () => {
    const recent: RecentSession[] = [];
    for (let d = 0; d < 8; d++) {
      const today = new Date(Date.parse('2026-09-28T12:00:00Z') + d * 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const s = generateSession({
        ...base,
        today,
        now: `${today}T12:00:00Z`,
        recentSessions: [...recent],
      });
      const groups = main(s).map((i) => group(i.exerciseId));
      const push = groups.filter((g) => g === 'push').length;
      const pull = groups.filter((g) => g === 'pull').length;
      expect(Math.abs(push - pull)).toBeLessThanOrEqual(1);
      recent.unshift({
        date: today,
        at: `${today}T12:00:00Z`,
        mainMuscles: main(s).flatMap((i) =>
          byId
            .get(i.exerciseId)!
            .muscles.filter((m) => m.role === 'primary')
            .map((m) => m.muscleKey),
        ),
      });
    }
  });

  it('rotates: the same slot picks different moves across days', () => {
    const picks = new Set<string>();
    for (let d = 0; d < 6; d++) {
      const today = new Date(Date.parse('2026-09-28T12:00:00Z') + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const s = generateSession({ ...base, today, now: `${today}T12:00:00Z` });
      picks.add(
        main(s)
          .map((i) => i.exerciseId)
          .join(','),
      );
    }
    expect(picks.size).toBeGreaterThanOrEqual(3);
  });

  it('respects "rest today": a muscle trained two sessions in a row stays out of the filler', () => {
    const recent: RecentSession[] = [
      { date: '2026-09-27', at: '2026-09-27T12:00:00Z', mainMuscles: ['chest', 'midChest'] },
      { date: '2026-09-26', at: '2026-09-26T12:00:00Z', mainMuscles: ['chest', 'midChest'] },
    ];
    const s = generateSession({ ...base, recentSessions: recent });
    expect(s.notes.some((n) => n.key === 'generator.notes.rested')).toBe(true);
    for (const i of main(s))
      for (const m of bySlug(i.exerciseId).muscles.filter((x) => x.role === 'primary'))
        expect(muscleByKey(m.muscleKey)?.parentKey ?? m.muscleKey).not.toBe('chest');
  });

  it('a gym "Get stronger" adult never gets a bodyweight main move', () => {
    for (let d = 0; d < 7; d++) {
      const today = new Date(Date.parse('2026-09-28T12:00:00Z') + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const s = generateSession({
        ...base,
        today,
        now: `${today}T12:00:00Z`,
        muscleGoals: [
          { muscleKey: 'quads', goal: 'strengthen' },
          { muscleKey: 'chest', goal: 'strengthen' },
          { muscleKey: 'lats', goal: 'strengthen' },
        ],
      });
      for (const i of main(s)) expect(bySlug(i.exerciseId).equipment.length).toBeGreaterThan(0);
    }
  });
});

describe('R2-10: trimmed muscles are named', () => {
  it('Joe, 5 goals at 20 min, hears which muscles come first next time', () => {
    const s = generateSession({
      ...base,
      minutes: 20,
      muscleGoals: ['chest', 'lats', 'quads', 'shoulders', 'biceps'].map((muscleKey) => ({
        muscleKey,
        goal: 'grow' as const,
      })),
    });
    const note = s.notes.find((n) => n.key === 'generator.notes.trimmedMuscles');
    expect(note).toBeTruthy();
    expect(note && 'muscles' in note ? note.muscles.length : 0).toBeGreaterThan(0);
  });
});

describe('tag fixes', () => {
  it('a knee restriction leaves out kneeling moves', () => {
    const input = { ...base, location: 'home' as const, equipment: [], restrictions: ['knee'] };
    for (const slug of ['cat_cow', 'knee_push_up', 'bird_dog', 'assisted_pull_up_machine']) {
      expect(
        blockReason(bySlug(slug), { ...input, location: 'gym', equipment: GYM_EQUIPMENT_OPTIONS }),
      ).toBe('contraindication');
    }
    const kneeling = LIBRARY.filter((e) =>
      e.joints.some((j) => j.joint === 'knee' && j.movement === 'kneel'),
    );
    for (const e of kneeling) expect(e.contraindications).toContain('knee');
  });

  it('walks carry knee and ankle tags', () => {
    for (const slug of ['brisk_walk', 'cw_arm_swing_walk', 'cw_slow_walk_room']) {
      const joints = bySlug(slug).joints.map((j) => j.joint);
      expect(joints).toEqual(expect.arrayContaining(['knee', 'ankle']));
    }
  });

  it('heart condition or high blood pressure: no breath-hold moves', () => {
    for (const condition of ['heart_condition', 'high_blood_pressure']) {
      const input = { ...base, location: 'home' as const, equipment: [], conditions: [condition] };
      expect(blockReason(bySlug('box_breathing'), input)).toBe('contraindication');
      expect(blockReason(bySlug('bridge_pillow_squeeze'), input)).toBe('contraindication');
      const s = generateSession(input);
      expect(s.items.some((i) => i.part === 'cooldown_breathing')).toBe(true);
    }
  });

  it('Laura (shoulder, recovery phase 1): no shoulder-ruled-out stretch in the cool-down', () => {
    const s = generateSession({
      ...base,
      mode: 'senior',
      band: 'senior',
      position: 'seated_only',
      location: 'home',
      equipment: [],
      muscleGoals: [{ muscleKey: 'upperBack', goal: 'strengthen' }],
      movementLimits: [
        {
          area: 'shoulder',
          joints: ['shoulder'],
          painful: ['shoulder.abduction' as MovementKey],
          painFree: ['shoulder.reach_behind' as MovementKey, 'shoulder.overhead' as MovementKey],
          score: 3,
          phase: 1,
        },
      ],
    });
    const cool = s.items.filter((i) => i.role === 'cooldown').map((i) => i.exerciseId);
    expect(cool).not.toContain('sv_seated_backrest_chest_opener');
    expect(cool).not.toContain('sv_cs_palms_up_overhead');
  });
});
