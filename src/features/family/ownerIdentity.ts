import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { secureStorage } from '@/lib/secureStorage';

import type { LocalProfile } from './store';

/**
 * Who the owner is (QA round 3, done with Phase 14; hardened in QA R4-05):
 * the family list lives in plain app storage, so a profile's `kind`, the
 * active id or the list itself could be edited. The Keychain / Keystore
 * keeps what the app itself decided:
 * - the owner's profile id (owner-only screens trust only that id);
 * - the active profile id, mirrored on every switch (a hand-edited active
 *   id no longer matches);
 * - which profiles are minors and their birth-date lock, set when a teen or
 *   child profile is created (a kind edited to "self" or "parent" stays a minor).
 */
export type MinorLock = 'teen' | 'under13';

type State = {
  ownerId: string | null;
  activeId: string | null;
  minors: Record<string, MinorLock>;
  remember: (id: string) => void;
  setActive: (id: string | null) => void;
  addMinor: (id: string, lock: MinorLock) => void;
  removeMinor: (id: string) => void;
  reset: () => void;
};

export const useOwnerIdentityStore = create<State>()(
  persist(
    (set, get) => ({
      ownerId: null,
      activeId: null,
      minors: {},
      // Set once, when the owner's own profile is first registered.
      remember: (id) => {
        if (!get().ownerId) set({ ownerId: id });
      },
      setActive: (activeId) => set({ activeId }),
      addMinor: (id, lock) => set({ minors: { ...get().minors, [id]: lock } }),
      removeMinor: (id) => {
        const minors = { ...get().minors };
        delete minors[id];
        set({ minors });
      },
      reset: () => set({ ownerId: null, activeId: null, minors: {} }),
    }),
    {
      name: 'owner-identity',
      version: 2,
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ ownerId, activeId, minors }) => ({ ownerId, activeId, minors }),
      migrate: (persisted) => ({ activeId: null, minors: {}, ...(persisted as object) }),
    },
  ),
);

/**
 * v1 records had an owner id but no active id or minors (QA R6-05). Once
 * both this record and the family list are loaded (family/store.ts calls
 * this), minors are seeded from the list: that only adds locks. The active
 * id is never taken from the plain family list, which could be edited:
 * - no minors on the phone: nobody to protect from, the owner is active;
 * - minors: it stays unproven, so the parent PIN is asked until the owner
 *   proves it (ParentGate records the owner as active on a correct PIN).
 */
export function seedOwnerIdentity(profiles: Pick<LocalProfile, 'id' | 'kind' | 'consentAt'>[]) {
  const s = useOwnerIdentityStore.getState();
  if (!s.ownerId || s.activeId) return;
  const minors: Record<string, MinorLock> = { ...s.minors };
  for (const p of profiles)
    if (p.kind === 'child' && !minors[p.id]) minors[p.id] = p.consentAt ? 'under13' : 'teen';
  useOwnerIdentityStore.setState({
    minors,
    activeId: Object.keys(minors).length ? null : s.ownerId,
  });
}

/**
 * The secure lock of the profile the app itself made active (QA R7-02/03):
 * the plain onboarding data (birth year, body) can be edited, this can't.
 */
export function activeMinorLock(): MinorLock | undefined {
  const { activeId, minors } = useOwnerIdentityStore.getState();
  return activeId ? minors[activeId] : undefined;
}

type Identity = Pick<State, 'ownerId' | 'activeId'>;

/**
 * The active profile is the owner's only when it is marked "self", its id is
 * the secure owner id, and the app itself made it active. With no family set
 * up yet (no owner id) the person on the phone is the owner.
 */
export function isOwnerProfile(
  p: Pick<LocalProfile, 'id' | 'kind'> | null | undefined,
  identity: Identity | string | null,
): boolean {
  const { ownerId, activeId } =
    typeof identity === 'object' && identity !== null
      ? identity
      : { ownerId: identity, activeId: null };
  // A missing or unknown active profile once a family exists: prove it with the PIN.
  if (!p) return !ownerId;
  if (p.kind !== 'self') return false;
  if (!ownerId) return true;
  // An owner id with no secure active id is unproven (QA R6-05).
  return p.id === ownerId && activeId === p.id;
}

/** The birth-date lock for a profile: from the secure record first, then its kind. */
export function minorLockFor(
  p: Pick<LocalProfile, 'id' | 'kind' | 'consentAt'> | null | undefined,
  minors: Record<string, MinorLock>,
): MinorLock | undefined {
  if (!p) return undefined;
  return minors[p.id] ?? (p.kind === 'child' ? (p.consentAt ? 'under13' : 'teen') : undefined);
}
