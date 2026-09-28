import type { Location } from '../../../supabase/functions/_shared/interview';
import type { EquipmentItem } from '../equipment/catalog';
import type { JointKey, JointMovementTag, MovementKey, MovementRange } from '../movement/catalog';
import type { Position } from '../onboarding/options';
import type { BodyBand } from '../profile/age';

import type {
  DoseType,
  Exercise,
  ExerciseStatus,
  MovementPattern,
  MuscleRole,
  SessionPart,
} from './types';

/** Shape of an entry in supabase/seed/exercises.json. */
export type SeedExercise = {
  slug: string;
  equipment: string[];
  location: string[];
  level: number;
  minAgeBand: string;
  positions: string[];
  contraindications: string[];
  pattern: string;
  parts: string[];
  dose: string;
  loaded: boolean;
  unilateral: boolean;
  impact: number;
  muscles: [string, string, number][];
  joints: [string, string, string][];
  rangeLimit: string[];
  rehab?: boolean;
  /** Single-joint work in a push/pull pattern (flys, face pulls): dosed 10–15, never heavy. */
  isolation?: boolean;
};

const tags = (joints: [string, string, string][]): JointMovementTag[] =>
  joints.map(([joint, movement, range]) => ({
    joint: joint as JointKey,
    movement,
    range: range as MovementRange,
  }));

export function fromSeed(entry: SeedExercise): Exercise {
  return {
    id: entry.slug,
    slug: entry.slug,
    nameKey: `exercises.${entry.slug}.name`,
    cuesKey: `exercises.${entry.slug}.cues`,
    equipment: entry.equipment as EquipmentItem[],
    location: entry.location as Location[],
    level: entry.level,
    minAgeBand: entry.minAgeBand as BodyBand,
    positions: entry.positions as Position[],
    contraindications: entry.contraindications,
    pattern: entry.pattern as MovementPattern,
    parts: entry.parts as SessionPart[],
    dose: entry.dose as DoseType,
    loaded: entry.loaded,
    unilateral: entry.unilateral,
    impact: entry.impact as 0 | 1 | 2,
    // The prototype library is draft only (SPEC §12 Phase 3).
    status: 'draft',
    muscles: entry.muscles.map(([muscleKey, role, emphasis]) => ({
      muscleKey,
      role: role as MuscleRole,
      emphasis,
    })),
    joints: tags(entry.joints),
    rangeLimit: entry.rangeLimit as MovementKey[],
    rehab: entry.rehab ?? false,
    isolation: entry.isolation ?? false,
    media: { video: null, poster: null, provider: 'prototype' },
  };
}

/** Row shape of `exercises` joined with `exercise_muscles` from Supabase. */
export type ExerciseRow = {
  id: string;
  slug: string;
  name_i18n_key: string;
  cues_i18n_key: string;
  equipment: string[];
  location: string[];
  level: number;
  min_age_band: string;
  positions: string[];
  contraindications: string[];
  movement_pattern: string;
  session_parts: string[];
  dose_type: string;
  loaded: boolean;
  unilateral: boolean;
  impact: number;
  status: string;
  media_video: string | null;
  media_poster: string | null;
  media_provider: string | null;
  joint_movements?: [string, string, string][] | null;
  range_limit?: string[] | null;
  rehab?: boolean | null;
  isolation?: boolean | null;
  exercise_muscles: { muscle_key: string; role: string; emphasis: number }[];
};

export function fromRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    slug: row.slug,
    nameKey: row.name_i18n_key,
    cuesKey: row.cues_i18n_key,
    equipment: row.equipment as EquipmentItem[],
    location: row.location as Location[],
    level: row.level,
    minAgeBand: row.min_age_band as BodyBand,
    positions: row.positions as Position[],
    contraindications: row.contraindications,
    pattern: row.movement_pattern as MovementPattern,
    parts: row.session_parts as SessionPart[],
    dose: row.dose_type as DoseType,
    loaded: row.loaded,
    unilateral: row.unilateral,
    impact: row.impact as 0 | 1 | 2,
    status: row.status as ExerciseStatus,
    muscles: row.exercise_muscles.map((m) => ({
      muscleKey: m.muscle_key,
      role: m.role as MuscleRole,
      emphasis: Number(m.emphasis),
    })),
    joints: tags(row.joint_movements ?? []),
    rangeLimit: (row.range_limit ?? []) as MovementKey[],
    rehab: row.rehab ?? false,
    isolation: row.isolation ?? false,
    media: { video: row.media_video, poster: row.media_poster, provider: row.media_provider },
  };
}

/**
 * The prototype drafts, for development builds only. The require must sit
 * INSIDE `if (__DEV__) { … }`: release builds inline __DEV__ as false and
 * drop the whole block, so the drafts never ship (an early `return` is not
 * enough — the require would still be bundled). Checked on real bundles.
 */
export function devLibrary(): Exercise[] {
  if (__DEV__) {
    const seed = require('../../../supabase/seed/exercises.json') as {
      exercises: SeedExercise[];
    };
    return seed.exercises.map(fromSeed);
  }
  return [];
}

/**
 * Prototype demo loop for an exercise (the AI `ex-*.mp4` placeholders).
 * Development builds only, with the same `if (__DEV__)` guard as the drafts;
 * `npm run bundle:check` proves no clip reaches a release bundle (SPEC §6).
 */
export function prototypeVideo(slug: string): number | null {
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const videos = require('../../../assets/prototype/videos.js') as Record<string, unknown>;
    const source = slug === '__label' ? undefined : videos[slug];
    return typeof source === 'number' ? source : null;
  }
  return null;
}

/** Select used to load the released library from Supabase (RLS: released only). */
export const RELEASED_LIBRARY_SELECT =
  'id, slug, name_i18n_key, cues_i18n_key, equipment, location, level, min_age_band, positions, ' +
  'contraindications, movement_pattern, session_parts, dose_type, loaded, unilateral, impact, ' +
  'status, media_video, media_poster, media_provider, joint_movements, range_limit, rehab, isolation, ' +
  'exercise_muscles (muscle_key, role, emphasis)';
