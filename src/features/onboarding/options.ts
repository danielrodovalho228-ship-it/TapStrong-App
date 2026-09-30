import type { MainGoal, MuscleGoal } from '../../../supabase/functions/_shared/interview';

import { PRESETS, type EquipmentItem } from '../equipment/catalog';

export {
  EQUIPMENT,
  INTERVIEW_STEPS,
  LOCATIONS,
  MAIN_GOALS,
  MAX_USER_TEXT,
  MUSCLE_GOALS,
} from '../../../supabase/functions/_shared/interview';
export type {
  Equipment,
  InterviewAnswer,
  InterviewStep,
  Location,
  MainGoal,
  MuscleGoal,
  MuscleGoalEntry,
  Sex,
} from '../../../supabase/functions/_shared/interview';

export type Who = 'me' | 'child' | 'parent';
export const WHO_OPTIONS: Who[] = ['me', 'child', 'parent'];

/**
 * Onboarding has 5 steps before the first workout (Phase 27, A1): age gate,
 * goals, schedule, body, safety. The focus muscles are asked later (the Body
 * tab, or editing the profile), and the summary is no longer a step: after
 * the safety check the first workout starts.
 */
export const TOTAL_STEPS = 5;
export const STEP_NUMBER = {
  who: 1,
  goals: 2,
  schedule: 3,
  focus: 4,
  body: 4,
  safety: 5,
  profile: 5,
} as const;

/** The interview steps asked before the first workout (Phase 27, A1). */
export const FIRST_RUN_STEPS = ['goals', 'schedule', 'body'] as const;

// Safety check (SPEC §2.2, mockup 04). Keys are stored in health_screen / restrictions.
export const PAIN_AREAS = [
  'neck',
  'shoulder',
  'elbow_wrist',
  'lower_back',
  'hip',
  'knee',
  'ankle_foot',
  'recent_surgery',
] as const;
export const CONDITIONS = [
  'heart_condition',
  'high_blood_pressure',
  'diabetes',
  'osteoporosis',
  'pregnant_postpartum',
  'fell_last_year',
] as const;
export const POSITIONS = ['standing', 'with_support', 'seated_only'] as const;

export type PainArea = (typeof PAIN_AREAS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Position = (typeof POSITIONS)[number];

/** Red flags that show the "check with your doctor" notice (SPEC §2.2). */
export const RED_FLAGS: readonly (PainArea | Condition)[] = [
  'heart_condition',
  'pregnant_postpartum',
  'recent_surgery',
];

export const MINUTES_OPTIONS = [20, 30, 40, 60] as const;
export const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;

/** Starting equipment per place (presets, improvements v1 C2). */
export const GYM_EQUIPMENT: EquipmentItem[] = PRESETS.fullGym.items;
export const HOME_EQUIPMENT_OPTIONS: EquipmentItem[] = PRESETS.homeGym.items;
export const GYM_EQUIPMENT_OPTIONS: EquipmentItem[] = PRESETS.fullGym.items;

/**
 * Default per-muscle goal when the user picks a muscle chip without saying
 * how they want to change it. Editable on the Goals screen (Phase 2).
 */
const GOAL_FOR_MAIN: Record<MainGoal, MuscleGoal> = {
  look: 'grow',
  lose_weight: 'firm',
  strength: 'strengthen',
  bone_health: 'strengthen',
  sport: 'strengthen',
  mobility: 'mobility',
  balance: 'balance',
  fitness: 'strengthen',
};

export function defaultMuscleGoal(mainGoals: readonly MainGoal[]): MuscleGoal {
  return mainGoals.length ? GOAL_FOR_MAIN[mainGoals[0]] : 'strengthen';
}
