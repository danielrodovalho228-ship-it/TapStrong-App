import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';

import { syncNow } from '../account/cloud';
import { useAccountStore } from '../account/store';
import { devLibrary } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { generateSession } from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import type { GeneratorInput } from '../generator/types';
import { limitFrom } from '../movement/progress';
import { activeReports, useMovementPainStore } from '../movement/store';
import { derive } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { activeAreas, doctorFirstAreas, useRestrictionsStore } from '../restrictions/store';

import { withFocus, recentSessions } from './plan';
import { dullPainAreasToday, safetyKey, safetyRefresh, sharpStopAreasToday } from './safety';
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
  const reports = useMovementPainStore((s) => s.reports);
  const today = localDate(clock.now());
  return inputFromProfile(profile, library, __DEV__, {
    restrictions: [
      ...new Set([...activeAreas(restrictions), ...sharpStopAreasToday(workouts, today)]),
    ],
    hardRestrictions: doctorFirstAreas(restrictions),
    painToday: dullPainAreasToday(workouts, today),
    stoppedToday: sharpStopAreasToday(workouts, today),
    movementLimits: activeReports(reports).map(limitFrom),
    recentSessions: recentSessions(workouts, library),
    today: localDate(clock.now()),
  });
}

/**
 * Re-checks a stored workout before it opens (QA A-01, C-04). Returns the id
 * to open: a fresh workout when a planned one is no longer safe.
 */
export function refreshWorkout(
  id: string,
  input: GeneratorInput | null,
  library: Exercise[],
): string | null {
  const store = useWorkoutStore.getState();
  const w = findWorkout(store.workouts, id);
  if (!w || !input) return id;
  const r = safetyRefresh(w, input);
  if (r.kind === 'ok') return id;
  if (r.kind === 'regenerate') {
    store.discard(id);
    return createWorkoutFrom(input, library);
  }
  store.replaceSession(id, r.session);
  for (const itemId of r.skip) store.skipItem(id, itemId);
  return id;
}

/**
 * Keeps an open workout safe while it is on screen: when restrictions or pain
 * reports change (e.g. a dull-pain swap), unsafe items still to do are
 * swapped or skipped; a planned workout is rebuilt (QA A-01, C-04).
 */
export function useSafetyRefresh(
  id: string | undefined,
  input: GeneratorInput | null,
  library: Exercise[],
) {
  const key = safetyKey(input);
  useEffect(() => {
    if (!id || !input) return;
    const next = refreshWorkout(id, input, library);
    if (next !== id)
      router.replace({ pathname: '/workout/[id]', params: { id: next ?? 'unavailable' } });
    // Re-run only when the safety side of the input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);
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
  if (milestone) {
    track('streak_milestone');
    useAccountStore.getState().update({
      milestone: {
        streak: useWorkoutStore.getState().streak.current,
        workoutId: id,
        at: clock.now().toISOString(),
      },
    });
  }
  // Copies the workout to the account when progress is saved (no-op otherwise).
  void syncNow();
}
