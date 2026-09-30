import { kvStorage } from '@/lib/storage';

import { useAccountStore } from '../account/store';
import { useBodyStore, type BodyEntry } from '../body/store';
import { useMovementPainStore, type MovementPain } from '../movement/store';
import { initialOnboarding, useOnboardingStore, type OnboardingData } from '../onboarding/store';
import { usePlacesStore, type Place } from '../equipment/store';
import { initialLibrary, useLibraryStore, type LibraryData } from '../library/store';
import { useProgramStore } from '../program/store';
import { initialProgress, useProgressStore, type ProgressData } from '../progress/store';
import { initialMonth, useMonthStore, type MonthData } from '../month/store';
import { useRestrictionsStore, type Restriction } from '../restrictions/store';
import { initialPrefs, usePrefsStore, type Prefs } from '../settings/store';
import { initialStreak, type StreakState } from '../workout/streak';
import { useWorkoutStore } from '../workout/store';
import type { NextFocus, WorkoutRecord } from '../workout/types';

import { useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore, type LocalProfile } from './store';

type Snapshot = {
  onboarding: Partial<OnboardingData>;
  workouts: WorkoutRecord[];
  streak: StreakState;
  nextFocus: NextFocus;
  restrictions: Restriction[];
  progress?: ProgressData;
  movementPain?: MovementPain[];
  program?: { planId: string | null; startedAt: string | null };
  library?: LibraryData;
  places?: { places: Place[]; activeId: string | null };
  prefs?: Prefs;
  body?: BodyEntry[];
  month?: MonthData;
};

const key = (id: string) => `profile-snapshot:${id}`;
const dataOnly = <T extends object>(s: T) =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as Partial<T>;

/** The month store's data only (Phase 26): each profile has its own cycle. */
const monthData = (s: MonthData): MonthData => ({
  reviewedFrom: s.reviewedFrom,
  offer: s.offer,
  cardUntil: s.cardUntil,
  resumeUntil: s.resumeUntil,
  plan: s.plan,
  previousPlan: s.previousPlan,
  banned: s.banned,
  history: s.history,
  autoNotice: s.autoNotice,
});

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
    movementPain: useMovementPainStore.getState().reports,
    program: (({ planId, startedAt }) => ({ planId, startedAt }))(useProgramStore.getState()),
    library: (({ favourites, notes, goals, custom }) => ({ favourites, notes, goals, custom }))(
      useLibraryStore.getState(),
    ),
    places: (({ places, activeId }) => ({ places, activeId }))(usePlacesStore.getState()),
    prefs: (({
      restStrength,
      restHold,
      sounds,
      voice,
      haptics,
      celebrationSounds,
      surprises,
      warmup,
      experience,
    }) => ({
      restStrength,
      restHold,
      sounds,
      voice,
      haptics,
      celebrationSounds,
      surprises,
      warmup,
      experience,
    }))(usePrefsStore.getState()),
    body: useBodyStore.getState().entries,
    month: monthData(useMonthStore.getState()),
  };
}

function load(snapshot: Snapshot | null, seed: Partial<OnboardingData>) {
  const onboarding = useOnboardingStore.getState();
  onboarding.reset();
  // A saved profile comes back exactly as it was stored, with no filters: a
  // locked teen's kept answers (pregnancy on a boy body model) must survive
  // a switch away and back (QA R8-01). A new profile starts from its seed.
  if (snapshot) useOnboardingStore.setState({ ...snapshot.onboarding });
  else onboarding.update(seed);
  useWorkoutStore.setState({
    workouts: snapshot?.workouts ?? [],
    streak: snapshot?.streak ?? initialStreak(),
    nextFocus: snapshot?.nextFocus ?? null,
    undo: null,
  });
  useRestrictionsStore.setState({ items: snapshot?.restrictions ?? [] });
  useProgressStore.setState({ ...initialProgress(), ...snapshot?.progress });
  useMonthStore.setState({ ...initialMonth(), ...snapshot?.month });
  useMovementPainStore.setState({ reports: snapshot?.movementPain ?? [] });
  useLibraryStore.setState({ ...initialLibrary(), ...snapshot?.library });
  usePrefsStore.setState({ ...initialPrefs(), ...snapshot?.prefs });
  useBodyStore.setState({ entries: snapshot?.body ?? [] });
  usePlacesStore.setState({
    places: snapshot?.places?.places ?? [],
    activeId: snapshot?.places?.activeId ?? null,
  });
  useProgramStore.setState({
    planId: snapshot?.program?.planId ?? null,
    startedAt: snapshot?.program?.startedAt ?? null,
  });
}

/** The owner's own profile, registered the first time the family is used. */
export function ensureSelfProfile(): LocalProfile {
  const family = useFamilyStore.getState();
  const selfId = useAccountStore.getState().profileId;
  const existing = family.profiles.find((p) => p.kind === 'self');
  if (existing) {
    useOwnerIdentityStore.getState().remember(existing.id);
    return existing;
  }
  family.add({ id: selfId, kind: 'self' });
  useOwnerIdentityStore.getState().remember(selfId);
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
  // Active first, so everything that runs while loading sees the target's lock.
  family.setActive(targetId);
  load(raw ? (JSON.parse(raw) as Snapshot) : null, { ...initialOnboardingSeed(), ...seed });
}

/**
 * Removes a family member (QA R2-01): frees the slot and deletes the member's
 * data on this phone. Never the owner's own profile. The caller shows the
 * parent gate first and deletes the cloud copy (remote.ts).
 */
export function removeMember(id: string): boolean {
  const family = useFamilyStore.getState();
  const target = family.profiles.find((p) => p.id === id);
  if (!target || target.kind === 'self') return false;
  if (family.activeId === id) switchProfile(ensureSelfProfile().id);
  kvStorage.removeItem(key(id));
  useFamilyStore.getState().remove(id);
  return true;
}

/** Forgets every profile snapshot (account deletion). */
export function clearSnapshots() {
  for (const p of useFamilyStore.getState().profiles) kvStorage.removeItem(key(p.id));
}

const initialOnboardingSeed = (): Partial<OnboardingData> => ({ units: initialOnboarding().units });
