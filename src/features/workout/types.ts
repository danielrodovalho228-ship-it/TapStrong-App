import type { GeneratedSession, SwapRecord } from '../generator/types';
import type { MovementGroup } from '../muscles';
import type { PainArea } from '../onboarding/options';

/** Mirrors `sessions.status` (SPEC §7); discarded workouts are deleted. */
export type WorkoutStatus = 'planned' | 'active' | 'done' | 'partial';

export type LoadUnit = 'lb' | 'kg';

/** One finished set or timed step (SPEC §7 `set_logs`). */
export type SetLog = {
  itemId: string;
  /** The exercise actually done — it changes when an item is swapped. */
  exerciseId: string;
  setNo: number;
  reps?: number;
  seconds?: number;
  load?: number;
  unit?: LoadUnit;
  /** How hard the set felt, 1–10 (optional; missing counts as 8 or easier). */
  rpe?: number;
  loggedAt: string;
};

export type Side = 'left' | 'right';
export type PainType = 'sharp' | 'dull' | 'tired';
/** "other" is recorded but has no matching contraindication. */
export type PainReportArea = PainArea | 'other';

export type PainAction = 'stopped' | 'swapped' | 'skipped' | 'continued';

export type PainReport = {
  itemId: string;
  exerciseId: string;
  area: PainReportArea;
  side?: Side;
  type: PainType;
  action: PainAction;
  reportedAt: string;
};

export type StoredSwap = SwapRecord & { at: string };

/** 'mobility': the short mobility session — an active day, never counted in the free limit. */
export type WorkoutKind = 'regular' | 'finisher' | 'repair' | 'mobility';

export type WorkoutRecord = {
  id: string;
  kind: WorkoutKind;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  status: WorkoutStatus;
  session: GeneratedSession;
  logs: SetLog[];
  /** Items the user skipped (cool-down, or an exercise after pain). */
  skipped: string[];
  swaps: StoredSwap[];
  pains: PainReport[];
  /** The full session before "Only 15 min", so it can be restored (QA P2). */
  fullSession?: GeneratedSession;
  /** Set once the finished workout is copied to the account (Phase 5). */
  syncedAt?: string;
  /** The exercise picked from "Exercises" in the player (Phase 31, D): done next. */
  focus?: string;
};

export type NextFocus = MovementGroup | null;
