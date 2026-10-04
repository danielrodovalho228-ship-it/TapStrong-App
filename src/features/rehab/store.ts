import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalDate } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';

import type { AffectedSide, DailyBlock, StrengthTiming } from './programs';
import type { RomEntry } from './progress';

/** The answer to "Did your physio clear shoulder and arm training?" (Phase 32 A2). */
export type Clearance = 'yes' | 'no' | 'unsure';
export const CLEARANCES: Clearance[] = ['yes', 'no', 'unsure'];

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
  /**
   * "Did your physio clear shoulder and arm training?" (addendum §6.4). null
   * = not answered: the main plan stays fully protected, as with "no".
   */
  cleared: boolean | null;
  /** The answer as given: "not sure" counts as no (only session A, mobility). */
  clearance?: Clearance;
  /** The physio released the program (§6.5): maintenance, main plan back gradually. */
  releasedAt: LocalDate | null;
  /** Sleeper stretch reminders, 3 times a day (§6.2). */
  sleeperReminders: boolean;
  /** "Full dose (from the physio)": the section 4 doses in the daily rhythm. */
  fullDose?: boolean;
  /** The daily block picked for a day instead of the suggested one (§6.2). */
  pick?: { date: LocalDate; block: DailyBlock };
  /**
   * On training days, strengthening after the main workout (default) or
   * before it (Daniel, Oct 3): only the stretches go first, as a warm-up.
   */
  strengthTiming?: StrengthTiming;
  /** "How high did you lift your arm today?", 0–180°, one per day (Phase 32 C). */
  rom?: RomEntry[];
};

export type RehabData = { runs: Record<string, ProgramRun> };

type State = RehabData & {
  start: (
    programId: string,
    side: AffectedSide,
    today: LocalDate,
    now: string,
    cleared?: Clearance | null,
  ) => void;
  setCleared: (programId: string, answer: Clearance) => void;
  release: (programId: string, today: LocalDate) => void;
  setSleeperReminders: (programId: string, on: boolean) => void;
  pickBlock: (programId: string, date: LocalDate, block: DailyBlock) => void;
  setFullDose: (programId: string, on: boolean) => void;
  setStrengthTiming: (programId: string, timing: StrengthTiming) => void;
  setSide: (programId: string, side: AffectedSide) => void;
  logRom: (programId: string, date: LocalDate, degrees: number) => void;
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
        start: (id, side, today, now, cleared = null) =>
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
                cleared: cleared ? cleared === 'yes' : null,
                ...(cleared ? { clearance: cleared } : {}),
                releasedAt: null,
                sleeperReminders: false,
                // Off until the physio says so (Phase 32 A3).
                fullDose: false,
                strengthTiming: 'after',
              },
            },
          })),
        setSide: (id, side) => patch(id, () => ({ side })),
        logRom: (id, date, degrees) =>
          patch(id, (r) => ({
            rom: [...(r.rom ?? []).filter((e) => e.date !== date), { date, degrees }],
          })),
        setMaintenance: (id, on) => patch(id, () => ({ maintenance: on })),
        setCleared: (id, answer) =>
          patch(id, () => ({ cleared: answer === 'yes', clearance: answer })),
        // Released by the physio: maintenance 2–3 times a week (§6.5).
        release: (id, today) => patch(id, () => ({ releasedAt: today, maintenance: true })),
        setSleeperReminders: (id, on) => patch(id, () => ({ sleeperReminders: on })),
        pickBlock: (id, date, block) => patch(id, () => ({ pick: { date, block } })),
        setFullDose: (id, on) => patch(id, () => ({ fullDose: on })),
        setStrengthTiming: (id, timing) => patch(id, () => ({ strengthTiming: timing })),
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
      version: 3,
      // v2 (addendum §6): physio clearance, release, sleeper reminders.
      // v3 (Phase 32 A3): "Full dose" and "strengthening before" back to off;
      // the old switch drew "off" so it read as "on", so no choice was clear.
      migrate: (persisted, version) => {
        const state = persisted as RehabData;
        for (const run of Object.values(state.runs ?? {})) {
          run.cleared ??= null;
          run.releasedAt ??= null;
          run.sleeperReminders ??= false;
          if (version < 3) {
            run.fullDose = false;
            run.strengthTiming = 'after';
          }
        }
        return state as State;
      },
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ runs }) => ({ runs }),
    },
  ),
);
