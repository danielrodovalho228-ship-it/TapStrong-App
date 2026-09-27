import type { Exercise } from '../exercises/types';
import type { MovementLimit } from '../movement/rules';
import { derive } from '../onboarding/derived';
import { restrictionAreas } from '../onboarding/safety';
import type { OnboardingData } from '../onboarding/store';
import { goalForMode } from '../onboarding/visible';

import type { GeneratorInput, RecentSession } from './types';

export type ProfileExtras = {
  /** Saved restrictions (pain reports, repair, manual), on top of the safety check. */
  restrictions?: string[];
  recentSessions?: RecentSession[];
  today?: string;
  /** Now (ISO time), for recovery hours. */
  now?: string;
  /** "Movement that hurts" reports (SPEC §8). */
  movementLimits?: MovementLimit[];
  /** Red-flag areas ("Doctor first"). */
  hardRestrictions?: string[];
  /** Dull pain reported today. */
  painToday?: string[];
  /** Sharp-pain stops today. */
  stoppedToday?: string[];
};

/** Builds generator input from the local profile (onboarding + body map). */
export function inputFromProfile(
  s: OnboardingData,
  library: Exercise[],
  includeDrafts: boolean,
  extras: ProfileExtras = {},
): GeneratorInput | null {
  const derived = derive(s);
  if (!derived || !s.location || !s.minutes) return null;
  return {
    library,
    includeDrafts,
    mode: derived.mode,
    // Safety uses the real age band, never the body picked on the map.
    band: derived.band,
    position: s.position,
    location: s.location,
    equipment: s.equipment,
    minutes: s.minutes,
    // Goals hidden for this age (e.g. "grow" for kids) are never trained.
    mainGoals: derived.mode === 'child' ? s.mainGoals.filter((g) => g !== 'look') : s.mainGoals,
    muscleGoals: s.muscleGoals.map((m) => ({ ...m, goal: goalForMode(m.goal, derived.mode) })),
    exercisesPerSession: s.exercisesPerSession,
    setsPerExercise: s.setsPerExercise,
    painAreas: s.painAreas,
    conditions: s.conditions,
    restrictions: [...new Set([...restrictionAreas(s.painAreas), ...(extras.restrictions ?? [])])],
    movementLimits: extras.movementLimits,
    hardRestrictions: extras.hardRestrictions,
    painToday: extras.painToday,
    stoppedToday: extras.stoppedToday,
    recentSessions: extras.recentSessions,
    today: extras.today,
    now: extras.now,
  };
}
