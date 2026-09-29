import { useState } from 'react';

import { useOwnerIdentityStore } from '../family/ownerIdentity';
import { useFamilyStore } from '../family/store';
import { useOnboardingStore } from '../onboarding/store';

import { familyPlanAllowed } from './actions';
import { startPlan, type Plan } from './rules';

/** familyPlanAllowed() for screens: re-renders when the profile or birth date changes. */
export function useFamilyPlanAllowed(): boolean {
  useOnboardingStore((s) => `${s.birthYear}-${s.birthMonth}`);
  useFamilyStore((s) => s.activeId);
  // The secure lock may load after the screen (QA R9 P2).
  useOwnerIdentityStore((s) => s.activeId);
  useOwnerIdentityStore((s) => s.minors);
  return familyPlanAllowed();
}

/**
 * The plan shown selected (QA R10 P2): the start plan follows the current
 * plan and whether Family is allowed, which can load after the screen, until
 * the person picks one. A Family pick no longer allowed falls back.
 */
export function usePlanChoice(
  current: Plan,
  wanted: string | undefined,
  familyOk: boolean,
): [Plan, (plan: Plan) => void] {
  const [picked, setPicked] = useState<Plan | null>(null);
  const valid = picked && (picked !== 'family' || familyOk) ? picked : null;
  return [valid ?? startPlan(current, wanted, familyOk), setPicked];
}
