import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SupportedLocale } from '@/i18n';
import type { EquipmentItem } from '../equipment/catalog';
import { kvStorage } from '@/lib/storage';

import { NEUTRAL_BODY_AVAILABLE, type BodySex, type BodyView } from '../bodymap/images';
import type { BodyBand } from '../profile/age';
import { deviceUnits, type Units } from '../profile/units';

import { derive } from './derived';

import {
  defaultMuscleGoal,
  GYM_EQUIPMENT,
  type Condition,
  type Equipment,
  type InterviewAnswer,
  type InterviewStep,
  type Location,
  type MainGoal,
  type MuscleGoalEntry,
  type PainArea,
  type Position,
  type Sex,
  type Who,
} from './options';
import { visibleConditions } from './safety';

export type ChatTurn = { userText?: string; reply?: string };

export type OnboardingData = {
  locale?: SupportedLocale;
  units: Units;
  who?: Who;
  birthMonth?: number;
  birthYear?: number;
  mainGoals: MainGoal[];
  location?: Location;
  minutes?: number;
  daysPerWeek?: number;
  /** Equipment items (improvements v1, C); old answers may hold coarse keys, read through normalizeEquipment. */
  equipment: (Equipment | EquipmentItem)[];
  muscleGoals: MuscleGoalEntry[];
  focusDeferred: boolean;
  /** undefined = not chosen; null = neutral body (SPEC §11.8). */
  sex?: Sex | null;
  heightCm?: number;
  weightKg?: number;
  painAreas: PainArea[];
  conditions: Condition[];
  position: Position;
  redFlagAcknowledged: boolean;
  chat: Partial<Record<InterviewStep, ChatTurn>>;
  completedSteps: InterviewStep[];
  safetyDone: boolean;
  onboardingComplete: boolean;
  /** Body shown on the map; defaults to the profile's band and sex (SPEC §5). */
  bodyModel: { band?: BodyBand; sex?: BodySex };
  bodyView: BodyView;
  exercisesPerSession: number;
  setsPerExercise: number;
};

type Actions = {
  update: (patch: Partial<OnboardingData>) => void;
  /** Merges a (validated) interview answer into the state. */
  applyAnswer: (step: InterviewStep, answer: InterviewAnswer) => void;
  setChatTurn: (step: InterviewStep, turn: ChatTurn) => void;
  completeStep: (step: InterviewStep) => void;
  toggleFocusMuscle: (muscleKey: string) => void;
  setLocation: (location: Location) => void;
  reset: () => void;
};

export const initialOnboarding = (): OnboardingData => ({
  units: deviceUnits(),
  mainGoals: [],
  equipment: [],
  muscleGoals: [],
  focusDeferred: false,
  painAreas: [],
  conditions: [],
  position: 'standing',
  redFlagAcknowledged: false,
  chat: {},
  completedSteps: [],
  safetyDone: false,
  onboardingComplete: false,
  bodyModel: {},
  bodyView: 'front',
  exercisesPerSession: 5,
  setsPerExercise: 3,
});

export const useOnboardingStore = create<OnboardingData & Actions>()(
  persist(
    (set, get) => ({
      ...initialOnboarding(),

      // Pregnancy is hidden for the male body, kids and 60+: drop it when the
      // body or the birth date changes (QA C-10, round 2).
      update: (patch) => {
        const next = { ...get(), ...patch };
        const mode = derive(next)?.mode;
        const conditions = patch.conditions ?? get().conditions;
        const hidden =
          conditions.includes('pregnant_postpartum') &&
          (next.sex === 'm' ||
            (mode !== undefined &&
              !visibleConditions(mode, next.sex).includes('pregnant_postpartum')));
        set(
          hidden
            ? { ...patch, conditions: conditions.filter((c) => c !== 'pregnant_postpartum') }
            : patch,
        );
      },

      applyAnswer: (step, a) => {
        const s = get();
        switch (step) {
          case 'goals':
            if (a.mainGoals) set({ mainGoals: a.mainGoals });
            break;
          case 'schedule':
            if (a.location) get().setLocation(a.location);
            set({
              minutes: a.minutes ?? s.minutes,
              daysPerWeek: a.daysPerWeek ?? s.daysPerWeek,
              ...(a.equipment ? { equipment: a.equipment } : {}),
            });
            break;
          case 'focus':
            if (a.muscleGoals) {
              const merged = [...s.muscleGoals];
              for (const entry of a.muscleGoals) {
                const i = merged.findIndex((m) => m.muscleKey === entry.muscleKey);
                if (i >= 0) merged[i] = entry;
                else merged.push(entry);
              }
              set({ muscleGoals: merged, focusDeferred: false });
            }
            break;
          case 'body':
            set({
              // Neutral body stays hidden until its images exist.
              ...(a.sex !== undefined && (a.sex !== null || NEUTRAL_BODY_AVAILABLE)
                ? { sex: a.sex }
                : {}),
              heightCm: a.heightCm ?? s.heightCm,
              weightKg: a.weightKg ?? s.weightKg,
              ...(a.sex === 'm'
                ? { conditions: s.conditions.filter((c) => c !== 'pregnant_postpartum') }
                : {}),
            });
            break;
        }
      },

      setChatTurn: (step, turn) => set({ chat: { ...get().chat, [step]: turn } }),

      completeStep: (step) => {
        const done = get().completedSteps;
        if (!done.includes(step)) set({ completedSteps: [...done, step] });
      },

      toggleFocusMuscle: (muscleKey) => {
        const s = get();
        const exists = s.muscleGoals.some((m) => m.muscleKey === muscleKey);
        set({
          focusDeferred: false,
          muscleGoals: exists
            ? s.muscleGoals.filter((m) => m.muscleKey !== muscleKey)
            : [...s.muscleGoals, { muscleKey, goal: defaultMuscleGoal(s.mainGoals) }],
        });
      },

      setLocation: (location) => {
        const s = get();
        // Sensible starting equipment per place; the user edits it right after.
        const equipment =
          location === s.location ? s.equipment : location === 'gym' ? GYM_EQUIPMENT : [];
        set({ location, equipment });
      },

      // zustand merges state, so optional fields (birth year, place…) must be
      // cleared explicitly or they would survive "Start over".
      reset: () => {
        const cleared = Object.fromEntries(
          Object.entries(get())
            .filter(([, value]) => typeof value !== 'function')
            .map(([key]) => [key, undefined]),
        );
        set({ ...cleared, ...initialOnboarding() });
      },
    }),
    {
      name: 'onboarding',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      // Persist data only, never the action functions.
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([, value]) => typeof value !== 'function'),
        ) as OnboardingData,
    },
  ),
);
