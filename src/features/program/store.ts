import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalDate } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';

/**
 * The person's program (improvements v1, A2/A5): an optional ready-made plan
 * and when the current block started. Kept per profile (switch.ts snapshots
 * it with the other stores).
 */
type State = {
  planId: string | null;
  startedAt: LocalDate | null;
  choosePlan: (planId: string | null, today: LocalDate) => void;
  ensureStarted: (today: LocalDate) => void;
  reset: () => void;
};

export const useProgramStore = create<State>()(
  persist(
    (set, get) => ({
      planId: null,
      startedAt: null,
      choosePlan: (planId, today) => set({ planId, startedAt: today }),
      ensureStarted: (today) => {
        if (!get().startedAt) set({ startedAt: today });
      },
      reset: () => set({ planId: null, startedAt: null }),
    }),
    {
      name: 'program',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ planId, startedAt }) => ({ planId, startedAt }),
    },
  ),
);
