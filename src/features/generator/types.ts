import type { Location } from '../../../supabase/functions/_shared/interview';
import type { EquipmentItem } from '../equipment/catalog';
import type { Exercise, SessionPart } from '../exercises/types';
import type { MovementLimit } from '../movement/rules';
import type { MovementGroup } from '../muscles';
import type { MainGoal, MuscleGoal, MuscleGoalEntry, Position } from '../onboarding/options';
import type { AppMode, BodyBand } from '../profile/age';

export type RecentSession = {
  /** ISO date of the session, most recent first. */
  date: string;
  /** Primary muscles of the main work that day. */
  mainMuscles: string[];
  /** When it ended (ISO time), for recovery hours. */
  at?: string;
  /** A Custom workout: counts for recovery, not for the "rest today" rule (QA R4 P2). */
  custom?: boolean;
  /** Main exercises done, so the next sessions vary (QA R4 P2). */
  exerciseIds?: string[];
  /** Working sets per parent muscle that day, once per set (weekly cap, QA R9-06). */
  muscleSets?: Record<string, number>;
  /** Working sets per joint area that day (joint-care budget, Daniel R9 decision 1). */
  jointSets?: Record<string, number>;
  /**
   * A "+10 min" finisher or a Repair session (QA R9-08): counts for the weekly
   * cap and recovery, not for variety or the push/pull balance.
   */
  kind?: 'finisher' | 'repair';
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
  /** The person's exact equipment items (improvements v1, C). */
  equipment: EquipmentItem[];
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
  /**
   * "Doctor first" areas (red flag): every exercise that moves a joint of the
   * area is left out, not only the ones ruled out for it (QA C-02).
   */
  hardRestrictions?: string[];
  /**
   * Areas with dull pain reported today: ruled out as a whole, even where a
   * "Movement that hurts" report would allow pain-free moves (QA A-05).
   */
  painToday?: string[];
  /** Areas where a sharp pain stopped a workout today: no exercise moving that joint today (QA R2-02). */
  /** The last week of a program block: 40% less volume (improvements v1, A2). */
  deload?: boolean;
  /**
   * A Repair plan session (QA R10-02): never cut by the weekly cap. Unlike
   * `rehab` (a movement-pain recovery session), the normal library and
   * rotation still apply.
   */
  repair?: boolean;
  /** Internal: no extra sets for spare time (the deload builds from this). */
  noExtraSets?: boolean;
  /**
   * Internal ("+1 exercise?", QA R9-02): the session's current main items,
   * kept as they are; only the extra slot is picked.
   */
  fixedMain?: SessionItem[];
  /** Starred exercises: preferred when safe (improvements v1, B4). */
  favourites?: string[];
  /** Shorter warm-up and cool-down (Settings, D4): shortened, never removed. */
  shortWarmup?: boolean;
  /** Experience level (Settings, D4): how far above the usual level a move may be. */
  experience?: 'new' | 'some' | 'experienced';
  /** A short mobility session (~10 min): mobility moves only, no recovery rule (QA round 2, decision 1). */
  mobilityOnly?: boolean;
  /**
   * A split plan's day (QA R4-08): the filler only adds these groups, so a
   * Push day stays push. Unset = balance push / pull / legs over the week.
   */
  dayGroups?: MovementGroup[];
  /** Single workout (A6): more work for the picked muscles, nothing else (QA R4 P2). */
  targetsOnly?: boolean;
  /** Now (ISO time): recovery hours for the targets (QA R2-08). */
  now?: string;
  stoppedToday?: string[];
  /**
   * "Movement that hurts" reports (SPEC §8): these areas are filtered movement
   * by movement instead of as a whole.
   */
  movementLimits?: MovementLimit[];
  /** Shorter pain-free range allowed (default true; recovery phases 1–2 set false). */
  allowReducedRange?: boolean;
  /** A Repair recovery session: recovery-only exercises may be used. */
  rehab?: boolean;
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
  /** Movement that hurts: a shorter pain-free range, or a gentle hold without moving. */
  range?: 'reduced' | 'isometric';
  /** Sets already done with earlier exercises before a swap. */
  replaced?: { exerciseId: string; setsDone: number }[];
};

export type GeneratorNote =
  | { key: 'generator.notes.balance'; groups: MovementGroup[] }
  | { key: 'generator.notes.rested'; muscles: string[] }
  | { key: 'generator.notes.trimmed'; count: number }
  /** Custom workout picks left out because they aren't safe for this profile. */
  | { key: 'generator.notes.customLeftOut'; count: number }
  /** Chosen muscles cut to fit the time; they come first next session (QA R2-10). */
  | { key: 'generator.notes.trimmedMuscles'; muscles: string[] }
  /** None of the chosen muscles had a safe exercise today; others were trained instead. */
  | { key: 'generator.notes.substituted'; muscles: string[] }
  /** Chosen muscles still recovering from a recent workout (QA R2-08). */
  | { key: 'generator.notes.recovering'; muscles: string[] }
  /** Chosen muscles with no safe exercise for this setup today (QA R2-10). */
  | { key: 'generator.notes.unavailable'; muscles: string[] }
  /** Chosen muscles left out today after pain was reported (QA R4 P2). */
  | { key: 'generator.notes.painToday'; muscles: string[] }
  | { key: 'generator.notes.weeklyCap'; muscles: string[] }
  | { key: 'generator.notes.jointCap'; joints: string[] }
  /** A chosen push muscle gave its slot to a pull move (Daniel, Phase 18). */
  | { key: 'generator.notes.pullAdded' }
  /** Exercises added with "+1" that no longer fit after a rebuild (QA R10 P2). */
  | { key: 'generator.notes.addedRemoved'; count: number };

export type GeneratedSession = {
  items: SessionItem[];
  minutes: number;
  warmupMinutes: number;
  cooldownMinutes: number;
  estimatedMinutes: number;
  notes: GeneratorNote[];
  /** A deload week: 40% less volume (improvements v1, A2). */
  deload?: boolean;
  /** Built from the person's own list (Custom workout, A6). */
  custom?: boolean;
  /** A short mobility or balance session instead of a workout (QA R3-03, R3-05). */
  focus?: 'mobility' | 'balance';
  /** Exercises the person added with "+1 exercise?" (kept on rebuilds, QA R9 P2). */
  addedExercises?: number;
  /** "Legs next time" chosen when this workout was built; "+1" and rebuilds keep it (QA R10 P2). */
  groupFocus?: MovementGroup;
  /** Set when no safe session can be built. */
  error?: 'no_library' | 'no_warmup' | 'no_cooldown' | 'no_main' | 'all_recovering' | 'weekly_cap';
};

export type SwapReason = 'user_choice' | 'machine_taken' | 'pain';

export type SwapRecord = {
  itemId: string;
  fromExerciseId: string;
  toExerciseId: string;
  reason: SwapReason;
  setsDoneBefore: number;
};
