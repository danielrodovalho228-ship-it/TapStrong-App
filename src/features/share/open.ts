import { router } from 'expo-router';

import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { AppMode } from '@/features/profile/age';

import { templatesFor } from './data';
import type { ShareTemplate } from './types';

export type ShareParams = {
  template?: ShareTemplate;
  workout?: string;
  exercise?: string;
  moment?: string;
  month?: string;
  range?: '4w';
  source?: 'button' | 'screenshot';
};

/**
 * Whether this profile may share at all (canShare: never a child, a teen only
 * with the parent's switch) and, with a template, whether that card is one
 * its age mode may make (Phase 28, E). Every share entry point checks this.
 */
export function useCanShare(template?: ShareTemplate): boolean {
  const mode = useOnboardingStore(modeOf);
  const member = useFamilyStore(activeProfile);
  return shareAllowed(member, mode, template);
}

export function shareAllowed(
  member: Parameters<typeof canShare>[0],
  mode: AppMode,
  template?: ShareTemplate,
): boolean {
  if (!canShare(member, mode)) return false;
  return !template || templatesFor(mode).includes(template);
}

/** Opens the share composer on a card (Phase 28, B). */
export function openShare(params: ShareParams = {}, replace = false) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null));
  const href = { pathname: '/share' as const, params: clean };
  if (replace) router.replace(href);
  else router.push(href);
}
