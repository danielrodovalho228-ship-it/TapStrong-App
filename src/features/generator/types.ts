import type { Equipment, Location } from '../../../supabase/functions/_shared/interview';
import type { Exercise, SessionPart } from '../exercises/types';
import type { MovementGroup } from '../muscles';
import type { MainGoal, MuscleGoal, MuscleGoalEntry, Position } from '../onboarding/options';
import type { AppMode, BodyBand } from '../profile/age';

export type RecentSession = {
  /** ISO date of the session, most recent first. */
  date: string;
  /** Primary muscles of the main work that day. */
  mainMuscles: string[];
};

/** Everything the generator needs. Pure data in, pure data out (SPEC §8). */
export type GeneratorInput = {
  library: Exercise[];
  /** Only development builds may use draft exercises. */
  includeDrafts: boolean;
  mode: AppMode;
  band: BodyBand;
  position: Position;
  location: Location;
  equipment: Equipment[];
  minutes: number;
  mainGoals: MainGoal[];
  /** In priority order (first = highest). */
  muscleGoals: MuscleGoalEntry[];
  exercisesPerSession: number;
  setsPerExercise: number;
  painAreas: string[];
  conditions: string[];
  /** Areas from the restrictions list (manual, pain reports, repair). */
  restrictions: string[];
  /** Most recent first. Used by the balance pass. */
  recentSessions?: RecentSession[];
  /** "Today" for the weekly window; defaults to the latest recent session. */
  today?: string;
};

export type ItemRole = 'warmup' | 'main' | 'finisher' | 'cooldown';
export type ItemPart = SessionPart | 'ramp_up';
export type LoadHint = 'bodyweight' | 'light' | 'moderate' | 'heavy' | 'ramp' | null;

export type SessionItem = {
  id: string;
  role: ItemRole;
  part: ItemPart;
  exerciseId: string;
  /** Muscle the item was chosen for (main work); drives swaps. */
  targetMuscle: string | null;
  goal: MuscleGoal | null;
  sets: number;
  reps?: [number, number];
  holdSeconds?: [number, number];
  durationSeconds?: number;
  restSeconds: number;
  perSide: boolean;
  loadHint: LoadHint;
  estSeconds: number;
  /** Sets already done with earlier exercises before a swap. */
  replaced?: { exerciseId: string; setsDone: number }[];
};

export type GeneratorNote =
  | { key: 'generator.notes.balance'; groups: MovementGroup[] }
  | { key: 'generator.notes.rested'; muscles: string[] }
  | { key: 'generator.notes.trimmed'; count: number };

export type GeneratedSession = {
  items: SessionItem[];
  minutes: number;
  warmupMinutes: number;
  cooldownMinutes: number;
  estimatedMinutes: number;
  notes: GeneratorNote[];
  /** Set when no safe session can be built. */
  error?: 'no_library' | 'no_warmup' | 'no_cooldown' | 'no_main';
};

export type SwapReason = 'user_choice' | 'machine_taken' | 'pain';

export type SwapRecord = {
  itemId: string;
  fromExerciseId: string;
  toExerciseId: string;
  reason: SwapReason;
  setsDoneBefore: number;
};
