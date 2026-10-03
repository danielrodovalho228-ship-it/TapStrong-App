import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import type { Scheme } from '@/theme';

/**
 * Settings → Appearance (theme v2): Automatic follows the phone, or a fixed
 * Light / Dark. Saved per device, not per profile. Dark is the default since
 * Phase 31 (graphite background, cards one step up); Light stays an option.
 */
export type Appearance = 'auto' | 'light' | 'dark';

type State = { appearance: Appearance; setAppearance: (a: Appearance) => void };

export const useAppearanceStore = create<State>()(
  persist((set) => ({ appearance: 'dark', setAppearance: (appearance) => set({ appearance }) }), {
    name: 'appearance',
    version: 2,
    // v2 (Phase 31): the old default "auto" becomes the new default, dark.
    // A choice of Light or Dark made before stays.
    migrate: (persisted, version) => {
      const state = persisted as { appearance: Appearance };
      if (version < 2 && state.appearance === 'auto') state.appearance = 'dark';
      return state as State;
    },
    storage: createJSONStorage(() => kvStorage),
    partialize: ({ appearance }) => ({ appearance }),
  }),
);

/** The scheme to show: the choice, or the phone's when Automatic. */
export const resolveScheme = (appearance: Appearance, system: string | null | undefined): Scheme =>
  appearance === 'auto' ? (system === 'dark' ? 'dark' : 'light') : appearance;
