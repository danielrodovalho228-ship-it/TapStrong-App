import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { secureStorage } from '@/lib/secureStorage';

import type { LocalProfile } from './store';

/**
 * Who the owner is (QA round 3, done with Phase 14): the family list lives in
 * plain app storage, so a profile's `kind` could be edited to "self". The
 * owner's profile id is also kept in the Keychain / Keystore; owner-only
 * screens trust a "self" profile only when its id matches.
 */
type State = { ownerId: string | null; remember: (id: string) => void; reset: () => void };

export const useOwnerIdentityStore = create<State>()(
  persist(
    (set, get) => ({
      ownerId: null,
      // Set once, when the owner's own profile is first registered.
      remember: (id) => {
        if (!get().ownerId) set({ ownerId: id });
      },
      reset: () => set({ ownerId: null }),
    }),
    {
      name: 'owner-identity',
      version: 1,
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ ownerId }) => ({ ownerId }),
    },
  ),
);

/** A profile is the owner's only when marked "self" AND its id matches the secure record. */
export function isOwnerProfile(
  p: Pick<LocalProfile, 'id' | 'kind'> | null,
  ownerId: string | null,
): boolean {
  if (!p) return true;
  return p.kind === 'self' && (!ownerId || p.id === ownerId);
}
