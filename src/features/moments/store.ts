import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

import type { Moment, ShownMoment } from './engine';

/**
 * The Moments a profile has seen, with the date (Phase 27, C2): the engine
 * reads it so a Moment never repeats, and the coach's question keeps its
 * answer. Synced like the other progress data (table `moments`).
 */
export type StoredMoment = ShownMoment & {
  /** Row id for sync. */
  rowId: string;
  params: Moment['params'];
  muscles?: string[];
  asks?: boolean;
  shared?: boolean;
};

type State = {
  shown: StoredMoment[];
  record: (m: Moment, at: Date, workoutId?: string | null) => StoredMoment;
  answer: (id: string, answer: 'good' | 'not_yet') => void;
  markShared: (id: string) => void;
  reset: () => void;
};

/** At most this many kept (oldest go first); milestones and facts are few. */
export const MAX_MOMENTS = 400;

export const useMomentsStore = create<State>()(
  persist(
    (set, get) => ({
      shown: [],
      record: (m, at, workoutId = null) => {
        const existing = get().shown.find((s) => s.id === m.id);
        if (existing) return existing;
        const row: StoredMoment = {
          rowId: uuid(),
          id: m.id,
          kind: m.kind,
          at: at.toISOString(),
          workoutId,
          answer: null,
          params: m.params,
          muscles: m.muscles,
          asks: m.asks,
        };
        set({ shown: [...get().shown, row].slice(-MAX_MOMENTS) });
        return row;
      },
      answer: (id, answer) =>
        set({ shown: get().shown.map((s) => (s.id === id ? { ...s, answer } : s)) }),
      markShared: (id) =>
        set({ shown: get().shown.map((s) => (s.id === id ? { ...s, shared: true } : s)) }),
      reset: () => set({ shown: [] }),
    }),
    {
      name: 'moments',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ shown }) => ({ shown }),
    },
  ),
);
