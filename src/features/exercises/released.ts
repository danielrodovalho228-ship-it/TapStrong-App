import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getSupabase } from '@/lib/supabase';
import { kvStorage } from '@/lib/storage';

import { devLibrary, fromRow, RELEASED_LIBRARY_SELECT, type ExerciseRow } from './library';
import type { Exercise } from './types';

/**
 * The released library (SPEC §2.1): only exercises a certified reviewer
 * approved reach users, read from Supabase (RLS returns released rows only)
 * and kept on the phone so workouts build offline. Refreshed on every launch;
 * a failed refresh keeps the last good copy. Development builds add the
 * drafts on top (`devLibrary`), so nothing changes there.
 */
type State = {
  rows: ExerciseRow[];
  fetchedAt: string | null;
  set: (rows: ExerciseRow[], at: string) => void;
};

export const useReleasedLibraryStore = create<State>()(
  persist(
    (set) => ({
      rows: [],
      fetchedAt: null,
      set: (rows, at) => set({ rows, fetchedAt: at }),
    }),
    {
      name: 'tapstrong\\released-library',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
    },
  ),
);

let refreshing: Promise<void> | null = null;

/** Loads the released library; offline or without a backend it does nothing. */
export function refreshReleasedLibrary(now = new Date()): Promise<void> {
  if (refreshing) return refreshing;
  const supabase = getSupabase();
  if (!supabase) return Promise.resolve();
  refreshing = (async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(RELEASED_LIBRARY_SELECT)
        .eq('status', 'released');
      // Never replace a good copy with nothing (a network or policy hiccup).
      if (error || !data?.length) return;
      useReleasedLibraryStore.getState().set(data as unknown as ExerciseRow[], now.toISOString());
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Drafts (development builds only) plus the released exercises, one per
 * slug: a released row wins over its draft, so a dev build shows the
 * reviewed version and its "checked by a coach" badge.
 */
export function mergeLibrary(drafts: Exercise[], rows: ExerciseRow[]): Exercise[] {
  const released = new Map(
    rows.filter((r) => r.status === 'released').map((r) => [r.slug, fromRow(r)]),
  );
  // A draft keeps its id, so workout history in a dev build still matches.
  const merged = drafts.map((d) => {
    const r = released.get(d.slug);
    return r ? { ...r, id: d.id } : d;
  });
  const draftSlugs = new Set(drafts.map((d) => d.slug));
  return [...merged, ...[...released.values()].filter((r) => !draftSlugs.has(r.slug))];
}

/** The library outside React (sync, cards). */
export function currentLibrary(): Exercise[] {
  return mergeLibrary(devLibrary(), useReleasedLibraryStore.getState().rows);
}
