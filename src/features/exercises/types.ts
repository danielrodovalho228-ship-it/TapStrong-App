import type { Equipment, Location } from '../../../supabase/functions/_shared/interview';
import type { JointMovementTag, MovementKey } from '../movement/catalog';
import type { Position } from '../onboarding/options';
import type { BodyBand } from '../profile/age';

/** Mirrors the Postgres enums in supabase/migrations/…_exercise_library.sql. */
export type ExerciseStatus = 'draft' | 'auto_checked' | 'second_checked' | 'released' | 'retired';
export type MuscleRole = 'primary' | 'secondary' | 'stabilizer';
export type DoseType = 'reps' | 'time';

export const SESSION_PARTS = [
  'warmup_general',
  'warmup_mobility',
  'main',
  'finisher_cardio',
  'finisher_mobility',
  'cooldown_walk',
  'cooldown_stretch',
  'cooldown_breathing',
] as const;
export type SessionPart = (typeof SESSION_PARTS)[number];

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'knee_flexion',
  'knee_extension',
  'calf',
  'ankle',
  'hip_isolation',
  'shoulder_isolation',
  'elbow_flexion',
  'elbow_extension',
  'wrist',
  'core_flexion',
  'core_stability',
  'rotation',
  'cardio',
  'mobility',
  'stretch',
  'balance',
  'breathing',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export type ExerciseMuscle = { muscleKey: string; role: MuscleRole; emphasis: number };

export type Exercise = {
  id: string;
  slug: string;
  nameKey: string;
  cuesKey: string;
  /** All required; empty = bodyweight. */
  equipment: Equipment[];
  location: Location[];
  level: number;
  minAgeBand: BodyBand;
  /** Position abilities the exercise suits. */
  positions: Position[];
  /** Pain areas and conditions that rule it out. */
  contraindications: string[];
  pattern: MovementPattern;
  parts: SessionPart[];
  dose: DoseType;
  loaded: boolean;
  unilateral: boolean;
  impact: 0 | 1 | 2;
  status: ExerciseStatus;
  muscles: ExerciseMuscle[];
  /** Joint movements the exercise needs (SPEC §8 "Movement that hurts"). */
  joints: JointMovementTag[];
  /** Movements it can do in a shorter, pain-free range. */
  rangeLimit: MovementKey[];
  /** Recovery-plan exercise: only in Repair recovery sessions, never in regular workouts. */
  rehab: boolean;
  media: { video: string | null; poster: string | null; provider: string | null };
};
