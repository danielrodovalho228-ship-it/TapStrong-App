import { defaultEquipment, normalizeEquipment } from '@/features/equipment/catalog';

import { useOnboardingStore } from './store';

/**
 * Marks onboarding complete. No preset or item picked: start from the
 * matching preset (QA R4 P2).
 */
export function finishOnboarding() {
  const s = useOnboardingStore.getState();
  const noEquipment = normalizeEquipment(s.equipment).length === 0;
  s.update({
    onboardingComplete: true,
    ...(noEquipment ? { equipment: defaultEquipment(s.location) } : {}),
  });
}
