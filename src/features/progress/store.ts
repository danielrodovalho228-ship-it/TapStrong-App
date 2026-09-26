import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

/**
 * Per-profile progress data (Phase 7): check-ins, before/after photo
 * references (files stay on this phone), Repair results and plan. Part of
 * the profile snapshot, so family members never share it.
 */
export type StrengthRow = {
  exerciseId: string;
  kind: 'load' | 'reps' | 'seconds';
  first: { value: number; reps?: number; unit?: 'lb' | 'kg' };
  last: { value: number; reps?: number; unit?: 'lb' | 'kg' };
  /** Percent for load × reps, plain difference for reps and seconds. */
  change: number;
};

export type Checkin = {
  id: string;
  takenAt: string;
  strength: StrengthRow[];
  /** Adults only (SPEC §2.3, §8 "Measurements"). */
  waistCm?: number;
  weightKg?: number;
  whtr?: number;
  bmi?: number;
};

export type Pose = 'front' | 'side' | 'back';
export type ProgressPhoto = { id: string; pose: Pose; uri: string; takenAt: string };

export type RepairResult = {
  testKey: string;
  value?: number;
  left?: number;
  right?: number;
  /** Pass/limited tests: true = passed. */
  passLeft?: boolean;
  passRight?: boolean;
  testedAt: string;
};

export type RepairPlan = {
  createdAt: string;
  weeks: number;
  sessionsPerWeek: number;
  focus: { muscleKey: string; goal: 'strengthen' | 'balance' | 'mobility' }[];
  retestAt: string;
};

export type ProgressData = {
  checkins: Checkin[];
  photos: ProgressPhoto[];
  repairResults: RepairResult[];
  repairPlan: RepairPlan | null;
  /** 60+ mode only: before/after photos are off until turned on (Daniel, Sep 2026). */
  seniorPhotos: boolean;
};

type State = ProgressData & {
  addCheckin: (c: Checkin) => void;
  addPhoto: (p: ProgressPhoto) => void;
  removePhoto: (id: string) => void;
  saveRepairResult: (r: RepairResult) => void;
  setRepairPlan: (p: RepairPlan | null) => void;
  setSeniorPhotos: (on: boolean) => void;
  reset: () => void;
};

export const initialProgress = (): ProgressData => ({
  checkins: [],
  photos: [],
  repairResults: [],
  repairPlan: null,
  seniorPhotos: false,
});

export const useProgressStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialProgress(),
      addCheckin: (c) => set({ checkins: [...get().checkins, c] }),
      addPhoto: (p) => set({ photos: [...get().photos, p] }),
      removePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
      saveRepairResult: (r) =>
        set({
          repairResults: [...get().repairResults.filter((x) => x.testKey !== r.testKey), r],
        }),
      setRepairPlan: (repairPlan) => set({ repairPlan }),
      setSeniorPhotos: (seniorPhotos) => set({ seniorPhotos }),
      reset: () => set(initialProgress()),
    }),
    {
      name: 'progress',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({
        checkins: s.checkins,
        photos: s.photos,
        repairResults: s.repairResults,
        repairPlan: s.repairPlan,
        seniorPhotos: s.seniorPhotos,
      }),
    },
  ),
);
