import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

import type { JointKey } from '../movement/catalog';

/**
 * The person's library (improvements v1, B): starred exercises, private
 * notes, exercise goals ("110 lb", D1) and exercises they made themselves.
 * Kept per profile (switch.ts snapshots it).
 */
export type CustomExerciseData = {
  id: string;
  name: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  joints: JointKey[];
  createdAt: string;
};

export type LibraryData = {
  favourites: string[];
  notes: Record<string, string>;
  goals: Record<string, { value: number; unit: 'lb' | 'kg' }>;
  custom: CustomExerciseData[];
};

type State = LibraryData & {
  toggleFavourite: (id: string) => void;
  setNote: (id: string, note: string) => void;
  setGoal: (id: string, goal: { value: number; unit: 'lb' | 'kg' } | null) => void;
  addCustom: (e: CustomExerciseData) => void;
  removeCustom: (id: string) => void;
  reset: () => void;
};

export const initialLibrary = (): LibraryData => ({
  favourites: [],
  notes: {},
  goals: {},
  custom: [],
});

export const useLibraryStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialLibrary(),
      toggleFavourite: (id) => {
        const f = get().favourites;
        set({ favourites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
      },
      setNote: (id, note) => set({ notes: { ...get().notes, [id]: note.slice(0, 1000) } }),
      setGoal: (id, goal) => {
        const goals = { ...get().goals };
        if (goal && goal.value > 0) goals[id] = goal;
        else delete goals[id];
        set({ goals });
      },
      addCustom: (e) => set({ custom: [...get().custom.filter((c) => c.id !== e.id), e] }),
      removeCustom: (id) =>
        set({
          custom: get().custom.filter((c) => c.id !== id),
          favourites: get().favourites.filter((x) => x !== id),
        }),
      reset: () => set(initialLibrary()),
    }),
    {
      name: 'library',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ favourites, notes, goals, custom }) => ({ favourites, notes, goals, custom }),
    },
  ),
);
