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

export type WorkoutKind = 'regular' | 'finisher';

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
  /** Set once the finished workout is copied to the account (Phase 5). */
  syncedAt?: string;
};

export type NextFocus = MovementGroup | null;
