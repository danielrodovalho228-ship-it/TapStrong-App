import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import type { PainArea } from '../onboarding/options';
import type { Side } from '../workout/types';

/**
 * Saved restrictions (SPEC §7 `restrictions`). They filter every future
 * workout (SPEC §2.2). The manage screen arrives in Phase 7; Phase 4 adds
 * them from pain reports.
 */
export type Restriction = {
  id: string;
  area: PainArea;
  side?: Side;
  source: 'pain_report' | 'repair' | 'manual';
  active: boolean;
  createdAt: string;
};

type State = {
  items: Restriction[];
  add: (r: Pick<Restriction, 'area' | 'side' | 'source'>) => void;
  reset: () => void;
};

export const useRestrictionsStore = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      add: ({ area, side, source }) => {
        const exists = get().items.some((r) => r.active && r.area === area && r.side === side);
        if (exists) return;
        const now = clock.now();
        set({
          items: [
            ...get().items,
            {
              id: `r${now.getTime().toString(36)}${get().items.length}`,
              area,
              side,
              source,
              active: true,
              createdAt: now.toISOString(),
            },
          ],
        });
      },
      reset: () => set({ items: [] }),
    }),
    {
      name: 'restrictions',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** Active areas; the side does not matter to contraindications. */
export function activeAreas(items: Restriction[]): PainArea[] {
  return [...new Set(items.filter((r) => r.active).map((r) => r.area))];
}
