import { create } from 'zustand';

/** Age modes — SPEC §8 "Age & mode". Set during onboarding (Phase 1). */
export type AppMode = 'child' | 'teen' | 'adult' | 'senior';

type AppModeState = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

export const useAppModeStore = create<AppModeState>((set) => ({
  mode: 'adult',
  setMode: (mode) => set({ mode }),
}));
