import { useMemo } from 'react';

import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';

import { devLibrary } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { generateSession } from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import type { GeneratorInput } from '../generator/types';
import { derive } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { activeAreas, useRestrictionsStore } from '../restrictions/store';

import { withFocus, recentSessions } from './plan';
import { bodyStates, muscleActivity } from './recovery';
import { findWorkout, useWorkoutStore } from './store';

/**
 * The exercise library this build may use. Development builds use the draft
 * prototype library; release builds load released exercises from Supabase
 * once accounts sync (Phase 5) and until then have none.
 */
export function useExerciseLibrary(): Exercise[] {
  return useMemo(() => devLibrary(), []);
}

/** Generator input from the profile, saved restrictions and workout history. */
export function useGeneratorInput(library: Exercise[]): GeneratorInput | null {
  const profile = useOnboardingStore();
  const restrictions = useRestrictionsStore((s) => s.items);
  const workouts = useWorkoutStore((s) => s.workouts);
  return inputFromProfile(profile, library, __DEV__, {
    restrictions: activeAreas(restrictions),
    recentSessions: recentSessions(workouts, library),
    today: localDate(clock.now()),
  });
}

/** Builds today's workout and stores it. Returns its id, or null when none is safe. */
export function createWorkoutFrom(input: GeneratorInput | null, library: Exercise[]) {
  if (!input) return null;
  const store = useWorkoutStore.getState();
  const session = generateSession(withFocus(input, store.nextFocus, library));
  if (session.error) return null;
  const id = store.create(session);
  if (store.nextFocus) store.setNextFocus(null);
  return id;
}

export function useWorkout(id: string | undefined) {
  const workout = useWorkoutStore((s) => findWorkout(s.workouts, id));
  const library = useExerciseLibrary();
  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const input = useGeneratorInput(library);
  return { workout, library, byId, input };
}

/** Recovery colors for the body map, from the whole history. */
export function useBodyStates() {
  const library = useExerciseLibrary();
  const workouts = useWorkoutStore((s) => s.workouts);
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const now = clock.now();
  const activity = muscleActivity(workouts, library, now);
  const tracked = profile.muscleGoals.map((g) => g.muscleKey);
  return { states: bodyStates(activity, now, mode, tracked), activity, library, now, mode };
}

/** Ends a workout and sends the SPEC §10 events. */
export function endWorkout(id: string, status: 'done' | 'partial') {
  const { milestone } = useWorkoutStore.getState().finish(id, status);
  track(status === 'done' ? 'workout_completed' : 'workout_ended_early');
  if (milestone) track('streak_milestone');
}
