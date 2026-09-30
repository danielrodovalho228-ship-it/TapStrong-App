import { useEffect, useRef } from 'react';

import { activeProfile, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { usePrefsStore } from '@/features/settings/store';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { useUsageStore } from '@/lib/usage';

import { pickMoment } from './engine';
import { useMomentsStore, type StoredMoment } from './store';

/**
 * The Moment for the end screen (`where: 'done'`, with the workout) or for
 * Home. It is chosen once, saved with its date (so it never repeats and the
 * next render shows the same one), and never during a workout: only these
 * two screens call it.
 */
export function useMoment(where: 'done' | 'home', workout?: WorkoutRecord | null) {
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const library = useExerciseLibrary();
  const workouts = useWorkoutStore((s) => s.workouts);
  const enabled = usePrefsStore((s) => s.surprises);
  const repairEven = useProgressStore((s) => s.repairEven);
  const installedAt = useUsageStore((s) => s.installedAt);
  const member = useFamilyStore(activeProfile);
  const { shown, record } = useMomentsStore();
  const now = clock.now();
  const today = localDate(now);

  const existing: StoredMoment | null =
    (where === 'done'
      ? shown.find((s) => !!workout && s.workoutId === workout.id)
      : shown.find(
          (s) =>
            !s.workoutId && s.kind !== 'month_highlight' && localDate(new Date(s.at)) === today,
        )) ?? null;

  const tried = useRef<string | null>(null);
  const key = `${where}|${workout?.id ?? today}|${enabled}`;
  useEffect(() => {
    if (existing || tried.current === key) return;
    tried.current = key;
    const m = pickMoment({
      now: clock.now(),
      seed: member?.id ?? 'self',
      mode,
      enabled,
      where,
      workout,
      workouts,
      library,
      shown,
      daysPerWeek: profile.daysPerWeek,
      birthMonth: profile.birthMonth,
      installedAt,
      repairEven: mode === 'adult' || mode === 'senior' ? repairEven : [],
    });
    if (!m) return;
    record(m, clock.now(), where === 'done' ? (workout?.id ?? null) : null);
    track('moment_shown', { kind: m.kind });
  });

  return enabled ? existing : null;
}
