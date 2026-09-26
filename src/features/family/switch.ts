import { kvStorage } from '@/lib/storage';

import { useAccountStore } from '../account/store';
import { initialOnboarding, useOnboardingStore, type OnboardingData } from '../onboarding/store';
import { initialProgress, useProgressStore, type ProgressData } from '../progress/store';
import { useRestrictionsStore, type Restriction } from '../restrictions/store';
import { initialStreak, type StreakState } from '../workout/streak';
import { useWorkoutStore } from '../workout/store';
import type { NextFocus, WorkoutRecord } from '../workout/types';

import { useFamilyStore, type LocalProfile } from './store';

type Snapshot = {
  onboarding: Partial<OnboardingData>;
  workouts: WorkoutRecord[];
  streak: StreakState;
  nextFocus: NextFocus;
  restrictions: Restriction[];
  progress?: ProgressData;
};

const key = (id: string) => `profile-snapshot:${id}`;
const dataOnly = <T extends object>(s: T) =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as Partial<T>;

function capture(): Snapshot {
  const w = useWorkoutStore.getState();
  return {
    onboarding: dataOnly(useOnboardingStore.getState()) as Partial<OnboardingData>,
    workouts: w.workouts,
    streak: w.streak,
    nextFocus: w.nextFocus,
    restrictions: useRestrictionsStore.getState().items,
    progress: (({ checkins, photos, repairResults, repairPlan, seniorPhotos }) => ({
      checkins,
      photos,
      repairResults,
      repairPlan,
      seniorPhotos,
    }))(useProgressStore.getState()),
  };
}

function load(snapshot: Snapshot | null, seed: Partial<OnboardingData>) {
  const onboarding = useOnboardingStore.getState();
  onboarding.reset();
  onboarding.update({ ...(snapshot?.onboarding ?? {}), ...(snapshot ? {} : seed) });
  useWorkoutStore.setState({
    workouts: snapshot?.workouts ?? [],
    streak: snapshot?.streak ?? initialStreak(),
    nextFocus: snapshot?.nextFocus ?? null,
    undo: null,
  });
  useRestrictionsStore.setState({ items: snapshot?.restrictions ?? [] });
  useProgressStore.setState({ ...initialProgress(), ...snapshot?.progress });
}

/** The owner's own profile, registered the first time the family is used. */
export function ensureSelfProfile(): LocalProfile {
  const family = useFamilyStore.getState();
  const selfId = useAccountStore.getState().profileId;
  const existing = family.profiles.find((p) => p.kind === 'self');
  if (existing) return existing;
  family.add({ id: selfId, kind: 'self' });
  if (!family.activeId) family.setActive(selfId);
  return useFamilyStore.getState().profiles.find((p) => p.kind === 'self')!;
}

/**
 * Makes another profile active: the current one is saved on the phone and
 * the target's data is loaded (a new profile starts its own onboarding,
 * seeded with who it is and the birth date the owner entered).
 */
export function switchProfile(targetId: string, seed: Partial<OnboardingData> = {}) {
  ensureSelfProfile();
  const family = useFamilyStore.getState();
  const current = family.activeId;
  if (current === targetId) return;
  if (current) kvStorage.setItem(key(current), JSON.stringify(capture()));
  const raw = kvStorage.getItem(key(targetId));
  load(raw ? (JSON.parse(raw) as Snapshot) : null, { ...initialOnboardingSeed(), ...seed });
  family.setActive(targetId);
}

/** Forgets every profile snapshot (account deletion). */
export function clearSnapshots() {
  for (const p of useFamilyStore.getState().profiles) kvStorage.removeItem(key(p.id));
}

const initialOnboardingSeed = (): Partial<OnboardingData> => ({ units: initialOnboarding().units });
