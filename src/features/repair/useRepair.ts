import { useMemo } from 'react';

import { derive } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { useProgressStore } from '../progress/store';
import { activeAreas, useRestrictionsStore } from '../restrictions/store';

import { findings, repairTests, testsFor } from './tests';

/** Repair tests this profile can do, with results and findings. */
export function useRepair() {
  const profile = useOnboardingStore();
  const restrictions = useRestrictionsStore((s) => s.items);
  const { repairResults, repairPlan } = useProgressStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const all = useMemo(() => repairTests(), []);
  const risks = [...profile.painAreas, ...profile.conditions, ...activeAreas(restrictions)];
  const tests = testsFor(all, profile.position, risks);
  return {
    all,
    tests,
    mode,
    results: repairResults,
    plan: repairPlan,
    found: findings(tests, repairResults, mode),
  };
}
