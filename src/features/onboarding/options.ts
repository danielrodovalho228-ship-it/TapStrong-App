import type {
  Equipment,
  MainGoal,
  MuscleGoal,
} from '../../../supabase/functions/_shared/interview';

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

/** Onboarding has 7 steps: age gate, 4 interview steps, safety, summary. */
export const TOTAL_STEPS = 7;
export const STEP_NUMBER = {
  who: 1,
  goals: 2,
  schedule: 3,
  focus: 4,
  body: 5,
  safety: 6,
  profile: 7,
} as const;

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

export const GYM_EQUIPMENT: Equipment[] = ['dumbbells', 'barbell', 'machines', 'cables', 'bench'];
export const HOME_EQUIPMENT_OPTIONS: Equipment[] = [
  'dumbbells',
  'bands',
  'kettlebell',
  'bench',
  'pull_up_bar',
  'mat',
];
export const GYM_EQUIPMENT_OPTIONS: Equipment[] = [
  'dumbbells',
  'barbell',
  'kettlebell',
  'machines',
  'cables',
  'bench',
  'pull_up_bar',
];

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
};

export function defaultMuscleGoal(mainGoals: readonly MainGoal[]): MuscleGoal {
  return mainGoals.length ? GOAL_FOR_MAIN[mainGoals[0]] : 'strengthen';
}
