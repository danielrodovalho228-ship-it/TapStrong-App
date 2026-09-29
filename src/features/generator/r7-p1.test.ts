/**
 * QA round 7 — P1 (generator): knee movers found by their cues carry the
 * knee (R7-01), and Short balance still builds after a knee stop.
 */
import seed from '../../../supabase/seed/exercises.json';
import en from '../../i18n/locales/en.json';
import { fromSeed, type SeedExercise } from '../exercises/library';

import { blockReason } from './filters';
import { generateBalanceSession } from './generate';
import type { GeneratorInput } from './types';

const RAW = seed.exercises as SeedExercise[];
const LIBRARY = RAW.map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const names = en.exercises as Record<string, { name: string; cues: string }>;
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: [],
  minutes: 30,
  mainGoals: ['balance'],
  muscleGoals: [],
  exercisesPerSession: 4,
  setsPerExercise: 2,
  painAreas: [],
  conditions: [],
  restrictions: [],
  stoppedToday: ['knee'],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};

describe('R7-01 knee movers', () => {
  it.each([
    'bal_seated_trunk_control',
    'wu_seated_ankle_circles',
    'fc_seated_jacks',
    'wu_seated_step_outs',
    'dead_bug',
    'reverse_crunch',
    'dead_bug_heel_tap',
    'bicycle_crunch',
    'band_dead_bug',
    'dumbbell_dead_bug',
    'cable_woodchop',
    'sv_cs_knee_drop_hip',
    'st_supine_twist',
    // QA R8-06
    'rx_dead_bug_hold',
    'rp_slow_reverse_crunch',
  ])('%s is ruled out after a sharp knee stop', (slug) => {
    const e = bySlug.get(slug)!;
    expect(
      blockReason(e, {
        ...base,
        equipment: e.equipment,
        location: e.location[0],
        position: e.positions[e.positions.length - 1],
        // Repair moves (QA R8-06) are judged the way Repair sessions build them.
        rehab: e.rehab,
      }),
    ).toBe('contraindication');
  });

  it('audit: every move whose cues lift, lower, tap, step or pivot a leg carries the knee', () => {
    const moves =
      /lift one foot|lift (?:one|a|your|the) (?:foot|feet|leg|knee)|lower (?:one|the opposite|the) (?:arm and )?leg|leg at a time|arm and leg|knees? toward|knees? up|bicycle|tap the feet|tap your feet|heel to tap|step (?:one foot )?out|step-out|pivot|march|jack|foot off|feet off|drop.*knee|knee.*drop|knees? (?:and hips )?at 90|toward your chest|hips off the floor/i;
    // Reviewed: the leg moves straight from the hip, the knee stays still.
    const kneeStill = new Set(['rp_prone_swimmer_lift']);
    // Reviewed: the chin, not the knees, goes toward the chest (QA R8-06).
    const chinOnly = new Set(['rp_band_neck_nod', 'rp_supine_head_lift_full']);
    const missing = RAW.filter((e) => {
      const t = names[e.slug];
      return (
        t &&
        moves.test(`${t.name} | ${t.cues}`) &&
        !kneeStill.has(e.slug) &&
        !chinOnly.has(e.slug) &&
        !e.joints.some((j) => j[0] === 'knee')
      );
    }).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it.each([
    [
      'Joe, seated only (60+)',
      {
        mode: 'senior',
        band: 'senior',
        position: 'seated_only',
        location: 'home',
        equipment: ['chair'],
      },
    ],
    ['Dave, standing adult', {}],
    ['Sam, teen', { mode: 'teen', band: 'teen', location: 'home' }],
  ] as const)(
    '%s: Short balance still builds after a knee stop, with no knee move',
    (_n, patch) => {
      const s = generateBalanceSession({ ...base, ...(patch as Partial<GeneratorInput>) });
      expect(s.error).toBeUndefined();
      for (const i of s.items) {
        const e = byId.get(i.exerciseId)!;
        expect(e.joints.some((j) => j.joint === 'knee')).toBe(false);
      }
      expect(s.items.some((i) => byId.get(i.exerciseId)!.slug === 'bal_seated_trunk_control')).toBe(
        false,
      );
    },
  );
});
