import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

import type { JointKey, MovementKey } from './catalog';

export type PainDuration = 'under_2_weeks' | '2_6_weeks' | '6_12_weeks' | 'over_3_months';

/** One traffic-light check (SPEC §8): right after a workout, or the next morning. */
export type PainCheck = {
  at: string;
  kind: 'after' | 'morning';
  /** The workout it belongs to. */
  workoutId: string;
  score: number;
};

/** Weekly retest: each painful movement rated 0–10. */
export type PainRetest = { at: string; scores: Partial<Record<MovementKey, number>> };

/**
 * A "Movement that hurts" report (SPEC §8). Per profile (part of the family
 * snapshot). Health data: never sent to analytics.
 */
export type MovementPain = {
  id: string;
  area: string;
  joints: JointKey[];
  side?: 'left' | 'right';
  painful: MovementKey[];
  painFree: MovementKey[];
  /** Worst pain when reported, 0–10. */
  score: number;
  duration: PainDuration;
  active: boolean;
  createdAt: string;
  checks: PainCheck[];
  retests: PainRetest[];
};

export type MovementPainData = { reports: MovementPain[] };

type State = MovementPainData & {
  add: (r: MovementPain) => void;
  addCheck: (id: string, check: PainCheck) => void;
  addRetest: (id: string, retest: PainRetest) => void;
  setActive: (id: string, active: boolean) => void;
  reset: () => void;
};

export const initialMovementPain = (): MovementPainData => ({ reports: [] });

export const useMovementPainStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialMovementPain(),
      // A new report for the same area and side replaces the old one.
      add: (r) =>
        set({
          reports: [
            ...get().reports.map((x) =>
              x.active && x.area === r.area && x.side === r.side ? { ...x, active: false } : x,
            ),
            r,
          ],
        }),
      addCheck: (id, check) =>
        set({
          reports: get().reports.map((r) =>
            r.id === id
              ? {
                  ...r,
                  checks: [
                    ...r.checks.filter(
                      (c) => !(c.workoutId === check.workoutId && c.kind === check.kind),
                    ),
                    check,
                  ],
                }
              : r,
          ),
        }),
      addRetest: (id, retest) =>
        set({
          reports: get().reports.map((r) =>
            r.id === id ? { ...r, retests: [...r.retests, retest] } : r,
          ),
        }),
      setActive: (id, active) =>
        set({ reports: get().reports.map((r) => (r.id === id ? { ...r, active } : r)) }),
      reset: () => set(initialMovementPain()),
    }),
    {
      name: 'movement-pain',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ reports: s.reports }),
    },
  ),
);

export const activeReports = (reports: MovementPain[]) => reports.filter((r) => r.active);
