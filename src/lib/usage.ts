import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { track } from './analytics';
import { clock } from './clock';
import { kvStorage } from './storage';

/**
 * Local, anonymous usage marks for Phase 27 "Measure": taps from opening the
 * app to the first logged set, time from install to the first exercise, and
 * coming back on day 7 and day 30. Only counts and time buckets leave the
 * device (through analytics); nothing about the body or health.
 */
type Usage = {
  installedAt: string | null;
  firstExerciseAt: string | null;
  returned: number[];
};

type State = Usage & {
  /** Called on every app open. */
  opened: (now: Date) => void;
  firstExercise: (now: Date) => void;
  reset: () => void;
};

export const RETURN_DAYS = [7, 30] as const;

export const useUsageStore = create<State>()(
  persist(
    (set, get) => ({
      installedAt: null,
      firstExerciseAt: null,
      returned: [],
      opened: (now) => {
        const { installedAt, returned } = get();
        if (!installedAt) return set({ installedAt: now.toISOString() });
        const days = Math.floor((now.getTime() - Date.parse(installedAt)) / 86_400_000);
        const due = RETURN_DAYS.filter((d) => days >= d && !returned.includes(d));
        if (!due.length) return;
        for (const day of due) track('app_returned', { day });
        set({ returned: [...returned, ...due] });
      },
      firstExercise: (now) => {
        const { installedAt, firstExerciseAt } = get();
        if (firstExerciseAt) return;
        const seconds = installedAt
          ? Math.round((now.getTime() - Date.parse(installedAt)) / 1000)
          : undefined;
        track('first_exercise_started', { seconds: bucket(seconds) });
        set({ firstExerciseAt: now.toISOString() });
      },
      reset: () => set({ installedAt: null, firstExerciseAt: null, returned: [] }),
    }),
    {
      name: 'usage',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ installedAt, firstExerciseAt, returned }) => ({
        installedAt,
        firstExerciseAt,
        returned,
      }),
    },
  ),
);

/** Coarse buckets: enough to see "under 90 s", never an exact timeline. */
export function bucket(seconds: number | undefined): number | undefined {
  if (seconds === undefined || seconds < 0) return undefined;
  for (const edge of [30, 60, 90, 120, 180, 300, 600]) if (seconds <= edge) return edge;
  return 601;
}

// Taps since the app was opened (Phase 27, A1 "taps to the first set").
let taps = 0;
let firstSetSent = false;

/** Buttons, links, chips and the Home hero count a tap. */
export function noteTap() {
  taps += 1;
}

/** The first set logged since the app was opened reports how many taps it took. */
export function noteSetLogged() {
  if (firstSetSent) return;
  firstSetSent = true;
  track('first_set_logged', { taps });
}

/** For tests. */
export function resetTaps() {
  taps = 0;
  firstSetSent = false;
}

/** On launch and whenever the app comes back to the foreground. */
export function watchAppOpens(): () => void {
  const open = () => {
    resetTaps();
    useUsageStore.getState().opened(clock.now());
  };
  open();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') open();
  });
  return () => sub.remove();
}
