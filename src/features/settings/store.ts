import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

/**
 * Workout preferences (improvements v1, D4). Kept per profile. The safety
 * rules never depend on these: warm-up and cool-down can be shortened, never
 * removed; rest defaults only replace the timer's starting value.
 */
export type Experience = 'new' | 'some' | 'experienced';
export type Prefs = {
  /** Rest for strength sets, in seconds (60–120); null = the session's own. */
  restStrength: number | null;
  /** Rest after holds, in seconds. */
  restHold: number;
  sounds: boolean;
  voice: boolean;
  /** Light vibrations on a set, an exercise and a record (Phase 27, B2). */
  haptics: boolean;
  /** A "tic" on each set and a short chord at the end: off by default (B2). */
  celebrationSounds: boolean;
  /** Moments, the small surprises (Phase 27, C): on by default. */
  surprises: boolean;
  warmup: 'standard' | 'short';
  experience: Experience;
};

export const initialPrefs = (): Prefs => ({
  restStrength: null,
  restHold: 30,
  sounds: true,
  voice: false,
  haptics: true,
  celebrationSounds: false,
  surprises: true,
  warmup: 'standard',
  experience: 'some',
});

type State = Prefs & { set: (patch: Partial<Prefs>) => void; reset: () => void };

export const usePrefsStore = create<State>()(
  persist(
    (set) => ({
      ...initialPrefs(),
      set: (patch) => set(patch),
      reset: () => set(initialPrefs()),
    }),
    {
      name: 'prefs',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({
        restStrength,
        restHold,
        sounds,
        voice,
        haptics,
        celebrationSounds,
        surprises,
        warmup,
        experience,
      }) => ({
        restStrength,
        restHold,
        sounds,
        voice,
        haptics,
        celebrationSounds,
        surprises,
        warmup,
        experience,
      }),
    },
  ),
);

/** Rest presets per role; 60+ get longer strength rests (D4). */
export const REST_PRESETS = {
  strength: [60, 90, 120],
  seniorStrength: [90, 120],
  hold: [20, 30, 45],
};

/** The rest the timer starts from: the preference when set, otherwise the session's. */
export function restFor(
  item: {
    reps?: [number, number];
    holdSeconds?: [number, number];
    restSeconds: number;
    role: string;
  },
  prefs: Pick<Prefs, 'restStrength' | 'restHold'>,
): number {
  if (item.role !== 'main' || item.restSeconds <= 0) return item.restSeconds;
  if (item.holdSeconds && !item.reps) return prefs.restHold;
  return prefs.restStrength ?? item.restSeconds;
}
