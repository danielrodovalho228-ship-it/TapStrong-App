import { execFileSync } from 'child_process';
import path from 'path';

import seed from '../../../supabase/seed/exercises.json';
import catalogJson from '../../../supabase/seed/joint_movements.json';
import { resources, SUPPORTED_LOCALES } from '../../i18n';

import type { MovementCatalog } from '../movement/catalog';

import { autoCheck } from './autoCheck';
import { devLibrary, fromRow, fromSeed, type SeedExercise } from './library';

const LIBRARY = (seed.exercises as SeedExercise[]).map(fromSeed);
const one = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;

describe('prototype library (SPEC §12 Phase 3)', () => {
  it('passes the automated rule check, every exercise', () => {
    expect(LIBRARY.flatMap((e) => autoCheck(e))).toEqual([]);
  });

  it('tags joint movements with catalog keys (SPEC §8 "Movement that hurts")', () => {
    const catalog = catalogJson as unknown as MovementCatalog;
    expect(LIBRARY.flatMap((e) => autoCheck(e, catalog))).toEqual([]);
    // Every exercise that loads a joint says how; breathing and walking may have none.
    const untagged = LIBRARY.filter(
      (e) => !e.joints.length && !['breathing', 'cardio'].includes(e.pattern),
    ).map((e) => e.slug);
    expect(untagged).toEqual([]);
    expect(
      autoCheck(
        { ...one('push_up'), joints: [{ joint: 'shoulder', movement: 'fly', range: 'full' }] },
        catalog,
      ),
    ).toContain('push_up: unknown movement shoulder.fly');
    expect(autoCheck({ ...one('push_up'), rangeLimit: ['knee.deep_bend'] }, catalog)).toContain(
      'push_up: range limit on a movement it does not use: knee.deep_bend',
    );
  });

  it('is draft only and never carries licensed media', () => {
    for (const e of LIBRARY) {
      expect(e.status).toBe('draft');
      expect(e.media.provider).toBe('prototype');
    }
  });

  it('has unique slugs', () => {
    expect(new Set(LIBRARY.map((e) => e.slug)).size).toBe(LIBRARY.length);
  });

  it('covers warm-up and cool-down for every position ability', () => {
    for (const position of ['standing', 'with_support', 'seated_only'] as const) {
      for (const part of [
        'warmup_general',
        'warmup_mobility',
        'cooldown_stretch',
        'cooldown_breathing',
      ] as const) {
        expect({
          position,
          part,
          found: LIBRARY.some((e) => e.parts.includes(part) && e.positions.includes(position)),
        }).toEqual({ position, part, found: true });
      }
    }
  });

  it('dev builds load it; the loader maps seed entries', () => {
    expect(devLibrary()).toHaveLength(LIBRARY.length);
    expect(one('push_up').nameKey).toBe('exercises.push_up.name');
  });

  it('supabase/seed.sql is generated from the JSON and up to date', () => {
    const script = path.join(__dirname, '../../../scripts/build-seed.mjs');
    expect(() => execFileSync('node', [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('maps database rows', () => {
    const e = fromRow({
      id: 'uuid-1',
      slug: 'push_up',
      name_i18n_key: 'exercises.push_up.name',
      cues_i18n_key: 'exercises.push_up.cues',
      equipment: [],
      location: ['home'],
      level: 3,
      min_age_band: 'kid',
      positions: ['standing'],
      contraindications: ['shoulder'],
      movement_pattern: 'horizontal_push',
      session_parts: ['main'],
      dose_type: 'reps',
      loaded: false,
      unilateral: false,
      impact: 0,
      status: 'released',
      media_video: 'v.mp4',
      media_poster: null,
      media_provider: 'gym_animations',
      exercise_muscles: [{ muscle_key: 'midChest', role: 'primary', emphasis: 1 }],
    });
    expect(e).toMatchObject({
      id: 'uuid-1',
      status: 'released',
      muscles: [{ muscleKey: 'midChest', emphasis: 1 }],
    });
  });
});

describe('autoCheck catches bad mappings and unsafe data', () => {
  const base = one('push_up');
  const problems = (patch: object) => autoCheck({ ...base, ...patch });

  it.each([
    [{ muscles: [] }, 'no primary muscle'],
    [{ muscles: [{ muscleKey: 'pecMinorDeep', role: 'primary', emphasis: 1 }] }, 'unknown muscle'],
    [
      { muscles: [{ muscleKey: 'midChest', role: 'primary', emphasis: 0.3 }] },
      'primary emphasis below 0.5',
    ],
    [
      {
        muscles: [
          { muscleKey: 'midChest', role: 'primary', emphasis: 0.6 },
          { muscleKey: 'triceps', role: 'secondary', emphasis: 0.9 },
        ],
      },
      'outweighs the primary',
    ],
    [{ loaded: true }, 'loaded exercise without weights'],
    [{ equipment: ['machines'] }, 'kids cannot use barbells or machines'],
    [{ impact: 2 }, 'high impact must rule out knee'],
    [{ positions: ['seated_only'], impact: 1 }, 'seated exercises must be low impact'],
    [{ contraindications: ['bad_knee'] }, 'unknown risk'],
    [{ pattern: 'stretch' }, 'stretches are holds'],
  ])('%j → %s', (patch, message) => {
    expect(problems(patch).join('\n')).toContain(message);
  });
});

describe('exercise names and cues', () => {
  it('exist in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const table = resources[locale].translation.exercises as Record<
        string,
        { name: string; cues: string }
      >;
      for (const e of LIBRARY) {
        expect({
          locale,
          slug: e.slug,
          ok: !!table[e.slug]?.name && !!table[e.slug]?.cues,
        }).toEqual({ locale, slug: e.slug, ok: true });
      }
    }
  });
});
