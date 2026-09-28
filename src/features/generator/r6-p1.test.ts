/**
 * QA round 6 — P1: short balance for seated-only people and after a knee
 * stop (R6-07), and seated moves that lift or bend the knee carry the knee
 * (R6-08).
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';

import { blockReason } from './filters';
import { generateBalanceSession } from './generate';
import type { GeneratorInput } from './types';

const RAW = seed.exercises as SeedExercise[];
const LIBRARY = RAW.map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const joe: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'senior',
  band: 'senior',
  position: 'seated_only',
  location: 'home',
  equipment: ['chair'],
  minutes: 30,
  mainGoals: ['balance'],
  muscleGoals: [],
  exercisesPerSession: 4,
  setsPerExercise: 2,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const mainOf = (s: ReturnType<typeof generateBalanceSession>) =>
  s.items.filter((i) => i.role === 'main').map((i) => byId.get(i.exerciseId)!);

describe('R6-07 short balance is never a dead end', () => {
  it('seated only (Joe): seated balance holds, all allowed seated', () => {
    const s = generateBalanceSession(joe);
    expect(s.error).toBeUndefined();
    const main = mainOf(s);
    expect(main.length).toBeGreaterThanOrEqual(2);
    for (const e of main) {
      expect(e.pattern).toBe('balance');
      expect(blockReason(e, joe)).toBeNull();
    }
    // Warm-up first and cool-down last, as in every session.
    expect(s.items[0].role).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
  });

  it('after a sharp knee stop: balance without the knee', () => {
    const input: GeneratorInput = {
      ...joe,
      mode: 'adult',
      band: 'adult',
      position: 'standing',
      stoppedToday: ['knee'],
    };
    const s = generateBalanceSession(input);
    expect(s.error).toBeUndefined();
    for (const e of mainOf(s)) {
      expect(e.pattern).toBe('balance');
      expect(e.joints.some((j) => j.joint === 'knee')).toBe(false);
    }
  });
});

describe('R6-08 seated knee moves carry the knee', () => {
  it.each([
    'sv_cw_seated_walking_arms',
    'sv_fc_seated_knee_elbow_taps',
    'sl_seated_knee_circles',
    'sv_seated_knee_hug_glute',
    'sl_seated_cross_body_knee_touch',
    'sl_seated_double_knee_tuck',
    'sl_seated_band_leg_back_pull',
    'rp_cable_woodchop',
  ])('rules out %s after a knee stop', (slug) => {
    expect(
      blockReason(bySlug.get(slug)!, {
        ...joe,
        mode: 'adult',
        band: 'adult',
        position: 'standing',
        location: 'gym',
        equipment: bySlug.get(slug)!.equipment,
        // Repair moves (rp_) are offered in recovery sessions only.
        rehab: slug.startsWith('rp_'),
        stoppedToday: ['knee'],
      }),
    ).toBe('contraindication');
  });

  it('audit: seated moves that lift or bend the knee carry the knee', () => {
    const lifts = /knee|march|walking|sprint|tuck|hover|leg_crossover|leg_back|leg_lift/;
    // Reviewed: hands on the knees or knee squeezes and presses, where the
    // knee itself does not move.
    const kneeStill = new Set([
      'sl_seated_knee_reach_crunch',
      'sl_seated_pelvic_tuck',
      'sl_seated_cross_knee_press_hold',
      'sl_seated_hands_out_knee_squeeze',
      'sl_seated_knee_out_press_hold',
      'sf_seated_fist_knee_squeeze',
      'sv_seated_hands_on_knees_lift',
    ]);
    const missing = RAW.filter(
      (e) =>
        (/seated/.test(e.slug) || e.positions.join() === 'seated_only') &&
        lifts.test(e.slug) &&
        !kneeStill.has(e.slug) &&
        !e.joints.some((j) => j[0] === 'knee'),
    ).map((e) => e.slug);
    expect(missing).toEqual([]);
  });
});
