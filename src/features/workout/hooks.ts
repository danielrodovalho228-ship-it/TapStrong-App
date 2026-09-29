import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';

import { syncNow } from '../account/cloud';
import { useAccountStore } from '../account/store';
import { devLibrary } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import {
  generateBalanceSession,
  generateMobilitySession,
  generateSession,
  withAddedExercises,
} from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import type { GeneratorInput } from '../generator/types';
import { limitFrom } from '../movement/progress';
import { activeReports, useMovementPainStore } from '../movement/store';
import { modeOf } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { activeAreas, doctorFirstAreas, useRestrictionsStore } from '../restrictions/store';

import { customToExercise } from '../library/custom';
import { useLibraryStore } from '../library/store';
import { withProgram } from '../program/apply';
import { allowedPlan } from '../program/plans';
import { usePrefsStore } from '../settings/store';
import { useProgramStore } from '../program/store';

import { withFocus, recentSessions } from './plan';
import {
  dullPainAreasToday,
  safetyKey,
  safetyRefresh,
  sharpStopAreasToday,
  workoutInput,
} from './safety';
import { bodyStates, muscleActivity } from './recovery';
import { findWorkout, useWorkoutStore } from './store';

/**
 * The exercise library this build may use. Development builds use the draft
 * prototype library; release builds load released exercises from Supabase
 * once accounts sync (Phase 5) and until then have none.
 */
export function useExerciseLibrary(): Exercise[] {
  // The person's own exercises join the library (B5); the generator never
  // programs them on its own.
  const custom = useLibraryStore((s) => s.custom);
  return useMemo(() => [...devLibrary(), ...custom.map(customToExercise)], [custom]);
}

/** Generator input from the profile, saved restrictions and workout history. */
export function useGeneratorInput(
  library: Exercise[],
  /** A future day's preview: that day's date and plan days ahead (QA R4-08). */
  ahead?: { date: string; days: number },
): GeneratorInput | null {
  const profile = useOnboardingStore();
  const restrictions = useRestrictionsStore((s) => s.items);
  const workouts = useWorkoutStore((s) => s.workouts);
  const reports = useMovementPainStore((s) => s.reports);
  const program = useProgramStore();
  const favourites = useLibraryStore((s) => s.favourites);
  const shortWarmup = usePrefsStore((s) => s.warmup === 'short');
  const experience = usePrefsStore((s) => s.experience);
  const today = localDate(clock.now());
  const laterDay = !!ahead && ahead.date > today;
  const base = inputFromProfile(profile, library, __DEV__, {
    // A sharp stop today is its own reason (stoppedToday rules the joint out
    // on its own), never a saved restriction: the Library says "left out
    // today", not "ruled out by a restriction" (QA R6 P2).
    restrictions: activeAreas(restrictions),
    hardRestrictions: doctorFirstAreas(restrictions),
    // Today's pain only rules today: a future day's preview is the real
    // plan for that day (QA R7 P2).
    painToday: laterDay ? [] : dullPainAreasToday(workouts, today),
    stoppedToday: laterDay ? [] : sharpStopAreasToday(workouts, today),
    movementLimits: activeReports(reports).map(limitFrom),
    recentSessions: recentSessions(workouts, library),
    today: localDate(clock.now()),
    now: clock.now().toISOString(),
  });
  // A plan for another age mode is cleared, not just ignored (QA R4-04).
  const mode = base?.mode;
  const invalidPlan = !!program.planId && !!mode && !allowedPlan(program.planId, mode);
  useEffect(() => {
    if (invalidPlan) useProgramStore.getState().choosePlan(null, localDate(clock.now()));
  }, [invalidPlan]);
  // A ready-made plan and the deload week apply on top (improvements v1, A2/A5).
  // Starred exercises are preferred when safe (B4).
  return base
    ? {
        ...withProgram(base, library, workouts, program, ahead?.date ?? today, ahead?.days ?? 0),
        favourites,
        shortWarmup,
        experience,
      }
    : null;
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
    const added = w.session.addedExercises ?? 0;
    store.discard(id);
    const next = createWorkoutFrom(input, library);
    // The exercises added with "+1" come along when they're still safe (QA R9 P2).
    const rebuilt = next ? findWorkout(useWorkoutStore.getState().workouts, next) : undefined;
    if (next && rebuilt && added)
      store.replaceSession(next, withAddedExercises(input, rebuilt.session, added));
    return next;
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

/**
 * Throws away today's planned regular workout that hasn't started, so the
 * next open builds it again: after a plan change or an equipment change
 * (QA R4-08, R4-09). A started workout is never touched.
 */
export function discardPlannedWorkouts() {
  const store = useWorkoutStore.getState();
  for (const w of store.workouts)
    if (w.status === 'planned' && w.kind === 'regular' && !w.logs.length) store.discard(w.id);
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

/** A short mobility session (decision 1, QA round 2): an active day, not in the free limit. */
export function createMobilityWorkout(input: GeneratorInput | null) {
  if (!input) return null;
  const session = generateMobilitySession(input);
  if (session.error) return null;
  return useWorkoutStore.getState().create(session, 'mobility');
}

/** A short balance session for an all-recovering day (QA R3-03); same rules as mobility. */
export function createBalanceWorkout(input: GeneratorInput | null) {
  if (!input) return null;
  const session = generateBalanceSession(input);
  if (session.error) return null;
  return useWorkoutStore.getState().create(session, 'mobility');
}

export function useWorkout(id: string | undefined) {
  const workout = useWorkoutStore((s) => findWorkout(s.workouts, id));
  const library = useExerciseLibrary();
  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const base = useGeneratorInput(library);
  const kind = workout?.kind;
  // Swaps and safety checks on this workout use its own rules (QA R3-07).
  const input = useMemo(() => (base ? workoutInput({ kind }, base) : base), [base, kind]);
  return { workout, library, byId, input };
}

/** Recovery colors for the body map, from the whole history. */
export function useBodyStates() {
  const library = useExerciseLibrary();
  const workouts = useWorkoutStore((s) => s.workouts);
  const profile = useOnboardingStore();
  const mode = modeOf(profile);
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
