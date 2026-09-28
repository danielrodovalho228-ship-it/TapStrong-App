import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

import type { Location } from '../../../supabase/functions/_shared/interview';
import { useOnboardingStore } from '../onboarding/store';

import type { EquipmentItem } from './catalog';

/**
 * Saved places (improvements v1, C2): e.g. "Gym" and "Home", each with its
 * own equipment list, switchable from the workout header. The active list
 * lives in the onboarding answers (what the generator reads).
 */
export type Place = { id: string; name: string; location: Location; items: EquipmentItem[] };

/** The place's list is exactly what is in use now. */
export const matchesPlace = (
  place: Place | undefined,
  location: Location | null | undefined,
  items: readonly string[],
) =>
  !!place &&
  place.location === location &&
  place.items.length === items.length &&
  place.items.every((i) => items.includes(i));

type State = {
  places: Place[];
  activeId: string | null;
  save: (place: Place) => void;
  remove: (id: string) => void;
  use: (id: string) => void;
  /** Clears the active place when the list in use no longer matches it (QA R4-09). */
  syncActive: (location: Location | null | undefined, items: readonly string[]) => void;
  reset: () => void;
};

export const usePlacesStore = create<State>()(
  persist(
    (set, get) => ({
      places: [],
      activeId: null,
      save: (place) => {
        const places = [...get().places.filter((p) => p.id !== place.id), place].slice(-6);
        set({ places, activeId: place.id });
      },
      remove: (id) =>
        set({
          places: get().places.filter((p) => p.id !== id),
          activeId: get().activeId === id ? null : get().activeId,
        }),
      use: (id) => {
        const place = get().places.find((p) => p.id === id);
        if (!place) return;
        set({ activeId: id });
        useOnboardingStore.getState().update({ location: place.location, equipment: place.items });
      },
      syncActive: (location, items) => {
        const { activeId, places } = get();
        if (
          activeId &&
          !matchesPlace(
            places.find((p) => p.id === activeId),
            location,
            items,
          )
        )
          set({ activeId: null });
      },
      reset: () => set({ places: [], activeId: null }),
    }),
    {
      name: 'places',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ places, activeId }) => ({ places, activeId }),
    },
  ),
);
