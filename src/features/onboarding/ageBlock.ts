import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

/**
 * Neutral age screen (Phase 12, store rule): once someone under 13 has
 * answered for themselves, this phone keeps saying "13 and up" — going back
 * and entering another birth date doesn't unlock it. Kept apart from the
 * onboarding answers, so "Start over" never clears it.
 */
type State = { blocked: boolean; block: () => void; reset: () => void };

export const useAgeBlockStore = create<State>()(
  persist(
    (set) => ({
      blocked: false,
      block: () => set({ blocked: true }),
      reset: () => set({ blocked: false }),
    }),
    {
      name: 'age-block',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ blocked }) => ({ blocked }),
    },
  ),
);
