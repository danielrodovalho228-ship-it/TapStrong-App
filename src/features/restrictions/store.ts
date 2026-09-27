import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';
import { isUuid, uuid } from '@/lib/uuid';

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
  /** doctor: a red flag in "Movement that hurts" — see a doctor first (QA C-02). */
  source: 'pain_report' | 'repair' | 'manual' | 'doctor';
  active: boolean;
  createdAt: string;
};

type State = {
  items: Restriction[];
  add: (r: Pick<Restriction, 'area' | 'side' | 'source'>) => void;
  /** "Mark healed" turns a restriction off; it stays in the history. */
  setActive: (id: string, active: boolean) => void;
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
              id: uuid(),
              area,
              side,
              source,
              active: true,
              createdAt: now.toISOString(),
            },
          ],
        });
      },
      setActive: (id, active) =>
        set({ items: get().items.map((r) => (r.id === id ? { ...r, active } : r)) }),
      reset: () => set({ items: [] }),
    }),
    {
      name: 'restrictions',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { items: Restriction[] };
        if (version < 2) {
          state.items = state.items.map((r) => (isUuid(r.id) ? r : { ...r, id: uuid() }));
        }
        return state as State;
      },
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** Active areas; the side does not matter to contraindications. */
/** Red-flag areas: every exercise that moves the joint is left out, not only the ruled-out ones. */
export function doctorFirstAreas(items: Restriction[]): PainArea[] {
  return [...new Set(items.filter((r) => r.active && r.source === 'doctor').map((r) => r.area))];
}

export function activeAreas(items: Restriction[]): PainArea[] {
  return [...new Set(items.filter((r) => r.active).map((r) => r.area))];
}
