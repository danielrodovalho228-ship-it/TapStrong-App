import type { Exercise } from '../exercises/types';
import { derive } from '../onboarding/derived';
import { restrictionAreas } from '../onboarding/safety';
import type { OnboardingData } from '../onboarding/store';

import type { GeneratorInput } from './types';

/** Builds generator input from the local profile (onboarding + body map). */
export function inputFromProfile(
  s: OnboardingData,
  library: Exercise[],
  includeDrafts: boolean,
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
    restrictions: restrictionAreas(s.painAreas),
  };
}
