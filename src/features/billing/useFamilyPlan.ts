import { useFamilyStore } from '../family/store';
import { useOnboardingStore } from '../onboarding/store';

import { familyPlanAllowed } from './actions';

/** familyPlanAllowed() for screens: re-renders when the profile or birth date changes. */
export function useFamilyPlanAllowed(): boolean {
  useOnboardingStore((s) => `${s.birthYear}-${s.birthMonth}`);
  useFamilyStore((s) => s.activeId);
  return familyPlanAllowed();
}
