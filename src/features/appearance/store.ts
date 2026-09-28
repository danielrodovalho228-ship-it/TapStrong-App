import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import type { Scheme } from '@/theme';

/**
 * Settings → Appearance (theme v2): Automatic follows the phone, or a fixed
 * Light / Dark. Saved per device, not per profile.
 */
export type Appearance = 'auto' | 'light' | 'dark';

type State = { appearance: Appearance; setAppearance: (a: Appearance) => void };

export const useAppearanceStore = create<State>()(
  persist((set) => ({ appearance: 'auto', setAppearance: (appearance) => set({ appearance }) }), {
    name: 'appearance',
    version: 1,
    storage: createJSONStorage(() => kvStorage),
    partialize: ({ appearance }) => ({ appearance }),
  }),
);

/** The scheme to show: the choice, or the phone's when Automatic. */
export const resolveScheme = (appearance: Appearance, system: string | null | undefined): Scheme =>
  appearance === 'auto' ? (system === 'dark' ? 'dark' : 'light') : appearance;
