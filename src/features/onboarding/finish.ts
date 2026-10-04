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

/** The shoulder program (Phase 30), for "I have a frozen or painful shoulder". */
export const SHOULDER_PROGRAM_ID = 'shoulder_mobility_strength';

/**
 * Where onboarding lands: the shoulder program when it was asked for on the
 * first step (Daniel, Oct 4), otherwise the given screen. The flag is used once.
 */
export function afterOnboarding<T>(
  fallback: T,
): T | { pathname: '/rehab/[id]'; params: { id: string } } {
  const s = useOnboardingStore.getState();
  if (!s.careShoulder) return fallback;
  s.update({ careShoulder: false });
  return { pathname: '/rehab/[id]', params: { id: SHOULDER_PROGRAM_ID } };
}
