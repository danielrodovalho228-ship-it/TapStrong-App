import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalDate } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';

import type { AffectedSide } from './programs';

/** One person's run of a rehab program (Phase 30). Kept per profile. */
export type ProgramRun = {
  side: AffectedSide;
  startedAt: LocalDate;
  /** The safety notes were read and accepted ("I understand"). */
  safetyAcceptedAt: string;
  /** After week 6: 2–3 sessions a week. */
  maintenance: boolean;
  /** Exercises whose load the person raised (slug → how many times). */
  increased: Record<string, number>;
  /** Exercises marked for review after "I feel pain" (slug → when). */
  review: Record<string, string>;
};

export type RehabData = { runs: Record<string, ProgramRun> };

type State = RehabData & {
  start: (programId: string, side: AffectedSide, today: LocalDate, now: string) => void;
  setSide: (programId: string, side: AffectedSide) => void;
  setMaintenance: (programId: string, on: boolean) => void;
  raiseLoad: (programId: string, slug: string) => void;
  markReview: (programId: string, slug: string, now: string) => void;
  clearReview: (programId: string, slug: string) => void;
  stop: (programId: string) => void;
  reset: () => void;
};

export const initialRehab = (): RehabData => ({ runs: {} });

export const useRehabStore = create<State>()(
  persist(
    (set) => {
      const patch = (id: string, f: (r: ProgramRun) => Partial<ProgramRun>) =>
        set((s) => {
          const run = s.runs[id];
          return run ? { runs: { ...s.runs, [id]: { ...run, ...f(run) } } } : s;
        });
      return {
        ...initialRehab(),
        start: (id, side, today, now) =>
          set((s) => ({
            runs: {
              ...s.runs,
              [id]: {
                side,
                startedAt: today,
                safetyAcceptedAt: now,
                maintenance: false,
                increased: {},
                review: {},
              },
            },
          })),
        setSide: (id, side) => patch(id, () => ({ side })),
        setMaintenance: (id, on) => patch(id, () => ({ maintenance: on })),
        raiseLoad: (id, slug) =>
          patch(id, (r) => ({
            increased: { ...r.increased, [slug]: (r.increased[slug] ?? 0) + 1 },
          })),
        markReview: (id, slug, now) => patch(id, (r) => ({ review: { ...r.review, [slug]: now } })),
        clearReview: (id, slug) =>
          patch(id, (r) => {
            const review = { ...r.review };
            delete review[slug];
            return { review };
          }),
        stop: (id) =>
          set((s) => {
            const runs = { ...s.runs };
            delete runs[id];
            return { runs };
          }),
        reset: () => set(initialRehab()),
      };
    },
    {
      name: 'rehab',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ runs }) => ({ runs }),
    },
  ),
);
