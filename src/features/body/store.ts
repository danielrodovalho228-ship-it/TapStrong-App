import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

/**
 * Progress → Body (improvements v1, D3), adults only: weight and optional
 * tape measurements, kept on the phone per profile. Teens never see or enter
 * these (the screen is hidden and the store stays empty).
 */
export const TAPE = ['waist', 'chest', 'hips', 'arm', 'thigh', 'calf'] as const;
export type TapeKey = (typeof TAPE)[number];
export type BodyEntry = { date: string; weightKg?: number } & Partial<
  Record<`${TapeKey}Cm`, number>
>;

type State = {
  entries: BodyEntry[];
  add: (e: BodyEntry) => void;
  reset: () => void;
};

export const useBodyStore = create<State>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (e) =>
        set({
          entries: [...get().entries.filter((x) => x.date !== e.date), e].sort((a, b) =>
            a.date < b.date ? -1 : 1,
          ),
        }),
      reset: () => set({ entries: [] }),
    }),
    {
      name: 'body',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ entries }) => ({ entries }),
    },
  ),
);

/** Latest value of each measurement across body entries and check-ins. */
export function latest(
  entries: BodyEntry[],
  checkins: { takenAt: string; waistCm?: number; weightKg?: number }[],
): { weightKg?: number } & Partial<Record<`${TapeKey}Cm`, number>> {
  const all = [
    ...checkins.map((c) => ({
      date: c.takenAt,
      waistCm: c.waistCm,
      weightKg: c.weightKg,
    })),
    ...entries,
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: Record<string, number> = {};
  for (const e of all)
    for (const [k, v] of Object.entries(e))
      if (k !== 'date' && typeof v === 'number' && v > 0) out[k] = v;
  return out;
}

/** Waist-to-height ratio, shown first (SPEC: WHtR before BMI). */
export const whtr = (waistCm?: number, heightCm?: number) =>
  waistCm && heightCm ? Math.round((waistCm / heightCm) * 100) / 100 : null;
