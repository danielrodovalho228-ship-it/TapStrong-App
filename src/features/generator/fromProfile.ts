import type { Exercise } from '../exercises/types';
import { derive } from '../onboarding/derived';
import { restrictionAreas } from '../onboarding/safety';
import type { OnboardingData } from '../onboarding/store';

import type { GeneratorInput, RecentSession } from './types';

export type ProfileExtras = {
  /** Saved restrictions (pain reports, repair, manual), on top of the safety check. */
  restrictions?: string[];
  recentSessions?: RecentSession[];
  today?: string;
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
    mainGoals: s.mainGoals,
    muscleGoals: s.muscleGoals,
    exercisesPerSession: s.exercisesPerSession,
    setsPerExercise: s.setsPerExercise,
    painAreas: s.painAreas,
    conditions: s.conditions,
    restrictions: [...new Set([...restrictionAreas(s.painAreas), ...(extras.restrictions ?? [])])],
    recentSessions: extras.recentSessions,
    today: extras.today,
  };
}
