import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';

import type { GeneratedSession, SwapRecord } from '../generator/types';

import { initialStreak, recordActiveDay, type StreakState } from './streak';
import type {
  NextFocus,
  PainReport,
  SetLog,
  WorkoutKind,
  WorkoutRecord,
  WorkoutStatus,
} from './types';

/** "Undo" stays available for 5 seconds after a swap (SPEC §8). */
export const UNDO_MS = 5000;
const MAX_HISTORY = 120;

export type UndoSwap = {
  workoutId: string;
  previous: GeneratedSession;
  expiresAt: number;
};

type Data = {
  workouts: WorkoutRecord[];
  streak: StreakState;
  /** "Legs next time" on the Done screen puts this group first once. */
  nextFocus: NextFocus;
  undo: UndoSwap | null;
};

type Actions = {
  create: (session: GeneratedSession, kind?: WorkoutKind) => string;
  replaceSession: (id: string, session: GeneratedSession) => void;
  start: (id: string) => void;
  logSet: (id: string, log: Omit<SetLog, 'loggedAt'>) => void;
  skipItem: (id: string, itemId: string) => void;
  applySwap: (id: string, session: GeneratedSession, record: SwapRecord) => void;
  undoSwap: () => boolean;
  addPain: (id: string, report: Omit<PainReport, 'reportedAt'>) => void;
  /** Ends a workout: done when everything is logged, partial otherwise. */
  finish: (
    id: string,
    status: Extract<WorkoutStatus, 'done' | 'partial'>,
  ) => { milestone: boolean };
  discard: (id: string) => void;
  setNextFocus: (focus: NextFocus) => void;
  reset: () => void;
};

const initial = (): Data => ({
  workouts: [],
  streak: initialStreak(),
  nextFocus: null,
  undo: null,
});

export const useWorkoutStore = create<Data & Actions>()(
  persist(
    (set, get) => {
      const update = (id: string, fn: (w: WorkoutRecord) => WorkoutRecord) =>
        set({ workouts: get().workouts.map((w) => (w.id === id ? fn(w) : w)) });
      const nowIso = () => clock.now().toISOString();

      return {
        ...initial(),

        create: (session, kind = 'regular') => {
          const now = clock.now();
          const id = `w${now.getTime().toString(36)}${get().workouts.length.toString(36)}`;
          const record: WorkoutRecord = {
            id,
            kind,
            createdAt: now.toISOString(),
            status: 'planned',
            session,
            logs: [],
            skipped: [],
            swaps: [],
            pains: [],
          };
          // Unstarted plans are replaced, not piled up.
          const kept = get().workouts.filter((w) => w.status !== 'planned');
          set({ workouts: [...kept, record].slice(-MAX_HISTORY), undo: null });
          return id;
        },

        replaceSession: (id, session) => update(id, (w) => ({ ...w, session })),

        start: (id) =>
          update(id, (w) =>
            w.status === 'planned' ? { ...w, status: 'active', startedAt: nowIso() } : w,
          ),

        logSet: (id, log) =>
          update(id, (w) => ({
            ...w,
            status: w.status === 'planned' ? 'active' : w.status,
            startedAt: w.startedAt ?? nowIso(),
            logs: [
              ...w.logs.filter((l) => !(l.itemId === log.itemId && l.setNo === log.setNo)),
              { ...log, loggedAt: nowIso() },
            ],
          })),

        skipItem: (id, itemId) =>
          update(id, (w) =>
            w.skipped.includes(itemId) ? w : { ...w, skipped: [...w.skipped, itemId] },
          ),

        applySwap: (id, session, record) => {
          const w = get().workouts.find((x) => x.id === id);
          if (!w) return;
          set({
            undo: {
              workoutId: id,
              previous: w.session,
              expiresAt: clock.now().getTime() + UNDO_MS,
            },
          });
          update(id, (x) => ({ ...x, session, swaps: [...x.swaps, { ...record, at: nowIso() }] }));
        },

        undoSwap: () => {
          const undo = get().undo;
          if (!undo || clock.now().getTime() > undo.expiresAt) {
            set({ undo: null });
            return false;
          }
          update(undo.workoutId, (w) => ({
            ...w,
            session: undo.previous,
            swaps: w.swaps.slice(0, -1),
          }));
          set({ undo: null });
          return true;
        },

        addPain: (id, report) =>
          update(id, (w) => ({ ...w, pains: [...w.pains, { ...report, reportedAt: nowIso() }] })),

        finish: (id, status) => {
          const w = get().workouts.find((x) => x.id === id);
          if (!w) return { milestone: false };
          const now = clock.now();
          update(id, (x) => ({ ...x, status, endedAt: now.toISOString() }));
          // Any logged set or step makes it an active day (SPEC §8).
          if (!w.logs.length) return { milestone: false };
          const { state, milestone } = recordActiveDay(get().streak, localDate(now));
          set({ streak: state });
          return { milestone };
        },

        discard: (id) => set({ workouts: get().workouts.filter((w) => w.id !== id), undo: null }),

        setNextFocus: (nextFocus) => set({ nextFocus }),

        reset: () => set(initial()),
      };
    },
    {
      name: 'workouts',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({
        workouts: s.workouts,
        streak: s.streak,
        nextFocus: s.nextFocus,
      }),
    },
  ),
);

export const findWorkout = (workouts: WorkoutRecord[], id: string | undefined) =>
  workouts.find((w) => w.id === id);
