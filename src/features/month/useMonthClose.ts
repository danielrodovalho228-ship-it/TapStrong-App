import { router } from 'expo-router';
import { useEffect } from 'react';

import { localDate } from '@/lib/dates';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import type { Exercise } from '../exercises/types';
import type { GeneratorInput } from '../generator/types';
import { useLibraryStore } from '../library/store';
import { muscleByKey } from '../muscles';
import { modeOf } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { blockAnchor, programStatus } from '../program/apply';
import { useProgramStore } from '../program/store';
import { useRepair } from '../repair/useRepair';
import { useWorkoutStore } from '../workout/store';

import { closeMonthIfDue } from './apply';

const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;

/**
 * On Home (Phase 26, E): closes the last block when it is due and opens the
 * "Month closed" screen once. Never during a workout, never for a profile
 * without workouts (monthDue says so).
 */
export function useMonthClose(input: GeneratorInput | null, library: Exercise[]) {
  const workouts = useWorkoutStore((s) => s.workouts);
  const program = useProgramStore();
  const profile = useOnboardingStore();
  const favourites = useLibraryStore((s) => s.favourites);
  const { tests, found } = useRepair();
  const today = localDate(clock.now());
  const active = workouts.some((w) => w.status === 'active');
  useEffect(() => {
    if (!input || active || !profile.onboardingComplete) return;
    const mode = modeOf(profile);
    const status = programStatus(program, workouts, today, mode);
    const uneven = found
      .filter((f) => f.grade === 'uneven')
      .flatMap((f) => tests.find((x) => x.key === f.testKey)?.focus.muscles ?? []);
    const due = closeMonthIfDue({
      now: clock.now(),
      anchor: blockAnchor(program, workouts, today),
      weeks: status.block.of,
      workouts,
      library,
      generator: input,
      mode,
      goals: [...new Set(profile.muscleGoals.map((g) => parentOf(g.muscleKey)))],
      favourites,
      uneven,
    });
    if (due?.kind === 'summary') {
      track('month_closed', { mode });
      router.push('/month');
    }
    // Once per open of Home with the day's data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, active, !!input, workouts.length]);
}
