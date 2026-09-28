import { derive } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';

import { allowedPlan } from './plans';
import { useProgramStore } from './store';

/**
 * Days per week the person trains: the active plan's, else the profile's.
 * One source for the week strip, day previews and reminders (QA R4-08, R4 P2).
 */
export function useTrainingDaysPerWeek(): number {
  const profile = useOnboardingStore();
  const planId = useProgramStore((s) => s.planId);
  const plan = allowedPlan(planId, derive(profile)?.mode);
  return plan?.daysPerWeek ?? profile.daysPerWeek ?? 3;
}
