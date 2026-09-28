import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import { FAMILY_MAX_PROFILES } from '../billing/rules';
import { seedOwnerIdentity, useOwnerIdentityStore } from './ownerIdentity';

/**
 * Profiles on this phone (SPEC §7: the account owner plus family members
 * they manage). Each profile's onboarding, workouts and restrictions are
 * kept apart; the active one is loaded into the live stores (switch.ts).
 */
export type ProfileKind = 'self' | 'child' | 'parent';

export type LocalProfile = {
  id: string;
  kind: ProfileKind;
  name?: string;
  createdAt: string;
  /** Children under 13: when the parent's verified consent was recorded. */
  consentAt?: string;
  /** A managed teen may share workouts only once the parent turns this on (A7). */
  shareAllowed?: boolean;
};

type State = {
  profiles: LocalProfile[];
  activeId: string | null;
  add: (p: Omit<LocalProfile, 'createdAt'>) => boolean;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  setShareAllowed: (id: string, allowed: boolean) => void;
  reset: () => void;
};

export const useFamilyStore = create<State>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,
      add: (p) => {
        const { profiles } = get();
        if (profiles.some((x) => x.id === p.id)) return true;
        if (profiles.length >= FAMILY_MAX_PROFILES) return false;
        set({ profiles: [...profiles, { ...p, createdAt: clock.now().toISOString() }] });
        // Minors are recorded in the secure store too, so an edited kind can't lift the lock.
        if (p.kind === 'child')
          useOwnerIdentityStore.getState().addMinor(p.id, p.consentAt ? 'under13' : 'teen');
        return true;
      },
      setActive: (activeId) => {
        useOwnerIdentityStore.getState().setActive(activeId);
        set({ activeId });
      },
      remove: (id) =>
        set({
          profiles: get().profiles.filter((p) => p.id !== id || p.kind === 'self'),
        }),
      setShareAllowed: (id, allowed) =>
        set({
          profiles: get().profiles.map((p) => (p.id === id ? { ...p, shareAllowed: allowed } : p)),
        }),
      reset: () => {
        // A cleared family list (sign-out, deleted account) forgets the owner too.
        useOwnerIdentityStore.getState().reset();
        set({ profiles: [], activeId: null });
      },
    }),
    {
      name: 'family',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId }),
    },
  ),
);

// v1 → v2 owner record: seeded once both stores have loaded (QA R6-05).
function seedWhenLoaded() {
  if (useOwnerIdentityStore.persist.hasHydrated() && useFamilyStore.persist.hasHydrated())
    seedOwnerIdentity(useFamilyStore.getState().profiles);
}
useOwnerIdentityStore.persist.onFinishHydration(seedWhenLoaded);
useFamilyStore.persist.onFinishHydration(seedWhenLoaded);
seedWhenLoaded();

export const activeProfile = (s: Pick<State, 'profiles' | 'activeId'>) =>
  s.profiles.find((p) => p.id === s.activeId) ?? null;

/**
 * Sharing a workout (improvements v1, A7): never in child mode; a teen on a
 * Family plan only when the parent turned it on; everyone else can.
 */
export function canShare(profile: LocalProfile | null, mode: string): boolean {
  if (mode === 'child') return false;
  // A minor by the secure record needs the parent's switch, whatever `kind`
  // says (QA R5 P2).
  const minor = !!profile && !!useOwnerIdentityStore.getState().minors[profile.id];
  if (profile?.kind === 'child' || minor) return profile?.shareAllowed === true;
  return true;
}
