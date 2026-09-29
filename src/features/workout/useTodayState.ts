import { useBillingStore } from '../billing/store';
import { modeOf } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { clock } from '@/lib/clock';

import { todayState, type TodayState } from './secondWorkout';
import { useWorkoutStore } from './store';

/** Today's state for the active profile (see secondWorkout.ts). */
export function useTodayState(): TodayState {
  const workouts = useWorkoutStore((s) => s.workouts);
  const entitlement = useBillingStore((s) => s.entitlement);
  const birthMonth = useOnboardingStore((s) => s.birthMonth);
  const birthYear = useOnboardingStore((s) => s.birthYear);
  return todayState({
    workouts,
    now: clock.now(),
    mode: modeOf({ birthMonth, birthYear }),
    entitlement,
  });
}
