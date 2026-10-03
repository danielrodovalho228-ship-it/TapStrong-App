import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

import type { GeneratedSession } from '../generator/types';

/**
 * "Customize exercise → Whole plan" (Phase 31, D): the person's own sets and
 * reps for an exercise, used by every workout built after. Kept within safe
 * bounds: 1–6 sets, 1–30 reps. Per profile, on this phone.
 */
export type DoseOverride = { sets: number; reps: [number, number] };

export const DOSE_LIMITS = { sets: [1, 6], reps: [1, 30] } as const;

const clampDose = (d: DoseOverride): DoseOverride => {
  const sets = Math.min(DOSE_LIMITS.sets[1], Math.max(DOSE_LIMITS.sets[0], Math.round(d.sets)));
  const lo = Math.min(DOSE_LIMITS.reps[1], Math.max(DOSE_LIMITS.reps[0], Math.round(d.reps[0])));
  const hi = Math.min(DOSE_LIMITS.reps[1], Math.max(lo, Math.round(d.reps[1])));
  return { sets, reps: [lo, hi] };
};

type State = {
  overrides: Record<string, DoseOverride>;
  set: (exerciseId: string, dose: DoseOverride) => void;
  clear: (exerciseId: string) => void;
  reset: () => void;
};

export const useDoseOverrides = create<State>()(
  persist(
    (set) => ({
      overrides: {},
      set: (exerciseId, dose) =>
        set((s) => ({ overrides: { ...s.overrides, [exerciseId]: clampDose(dose) } })),
      clear: (exerciseId) =>
        set((s) => {
          const overrides = { ...s.overrides };
          delete overrides[exerciseId];
          return { overrides };
        }),
      reset: () => set({ overrides: {} }),
    }),
    {
      name: 'dose-overrides',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ overrides }) => ({ overrides }),
    },
  ),
);

export { clampDose };

/** The session with the person's own doses on main rep exercises. */
export function withDoseOverrides(
  session: GeneratedSession,
  overrides: Record<string, DoseOverride> = useDoseOverrides.getState().overrides,
): GeneratedSession {
  if (session.error || !Object.keys(overrides).length) return session;
  return {
    ...session,
    items: session.items.map((i) => {
      const o = overrides[i.exerciseId];
      return o && i.role === 'main' && i.reps ? { ...i, sets: o.sets, reps: o.reps } : i;
    }),
  };
}
