import { derive } from '../onboarding/derived';
import type { OnboardingData } from '../onboarding/store';
import type { AppMode } from '../profile/age';

import type { LocalProfile } from './store';

const KEY = (id: string) => `profile-snapshot:${id}`;

export type ProfileSummary = { profile: LocalProfile; mode: AppMode | null; age: number | null };

/** Age mode of a stored profile, from its onboarding answers. */
export function summarize(
  profile: LocalProfile,
  activeId: string | null,
  live: OnboardingData,
  read: (key: string) => string | null,
): ProfileSummary {
  let data: Partial<OnboardingData> | undefined;
  if (profile.id === activeId) data = live;
  else {
    const raw = read(KEY(profile.id));
    data = raw
      ? (JSON.parse(raw) as { onboarding: Partial<OnboardingData> }).onboarding
      : undefined;
  }
  const d = data ? derive({ birthMonth: data.birthMonth, birthYear: data.birthYear }) : null;
  return { profile, mode: d?.mode ?? null, age: d?.age ?? null };
}
