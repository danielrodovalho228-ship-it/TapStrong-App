import type { Exercise } from '../exercises/types';
import type { GeneratorInput } from '../generator/types';
import type { MovementGroup } from '../muscles';
import type { MainGoal, MuscleGoal } from '../onboarding/options';
import type { AppMode } from '../profile/age';
import { muscleFamily } from '../muscles';
import { groupMuscles } from '../workout/recovery';

/**
 * Ready-made plans (improvements v1, A5). A plan only sets the split, the
 * targets and the session length; the generator still picks every exercise
 * through the safety filters. "My plan" (from the coach) stays the default.
 */
export type PlanGoal =
  'shape' | 'muscle' | 'strength' | 'weightLoss' | 'mobilityBalance' | 'seniorSteady';
export type PlanSplit = 'fullBody' | 'upperLower' | 'ppl';
export type PlanDay = {
  name: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullBody' | 'mobility';
  groups: (MovementGroup | 'mobility')[];
};

export type ReadyPlan = {
  id: string;
  goal: PlanGoal;
  split: PlanSplit;
  daysPerWeek: number;
  minutes: number;
  days: PlanDay[];
  /** Age modes the plan is offered in. */
  modes: AppMode[];
  blockWeeks: number;
  /** Strength and muscle plans work best with weights (A5 equipment filter). */
  equipment: 'weights' | 'any';
};

const FULL: PlanDay = { name: 'fullBody', groups: ['push', 'pull', 'legs'] };
const UPPER: PlanDay = { name: 'upper', groups: ['push', 'pull'] };
const LOWER: PlanDay = { name: 'lower', groups: ['legs', 'core'] };
const PUSH: PlanDay = { name: 'push', groups: ['push'] };
const PULL: PlanDay = { name: 'pull', groups: ['pull'] };
const LEGS: PlanDay = { name: 'legs', groups: ['legs'] };
const MOBILITY: PlanDay = { name: 'mobility', groups: ['mobility'] };

function splitDays(split: PlanSplit, days: number): PlanDay[] {
  if (split === 'fullBody') return Array.from({ length: days }, () => FULL);
  if (split === 'upperLower')
    return Array.from({ length: days }, (_, i) => (i % 2 ? LOWER : UPPER));
  return Array.from({ length: days }, (_, i) => [PUSH, PULL, LEGS][i % 3]);
}

/** Which splits make sense for how many days. */
const SPLITS_FOR: Record<number, PlanSplit[]> = {
  2: ['fullBody', 'upperLower'],
  3: ['fullBody', 'ppl'],
  4: ['upperLower', 'fullBody'],
  5: ['upperLower', 'ppl'],
  6: ['ppl', 'upperLower'],
};

const ALL: AppMode[] = ['teen', 'adult', 'senior'];

function build(): ReadyPlan[] {
  const out: ReadyPlan[] = [];
  const strengthGoals: PlanGoal[] = ['shape', 'muscle', 'strength', 'weightLoss'];
  for (const goal of strengthGoals) {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const split of SPLITS_FOR[days]) {
        out.push({
          id: `${goal}-${split}-${days}`,
          goal,
          split,
          daysPerWeek: days,
          minutes: goal === 'weightLoss' ? 40 : goal === 'shape' ? 40 : 50,
          days: splitDays(split, days),
          // Teens: no weight-loss plan (no calorie content for minors).
          // 60+: no push/pull/legs on 5–6 days, the 90 h recovery can't fit (QA R5 P2).
          modes: (goal === 'weightLoss'
            ? (['adult', 'senior'] as AppMode[])
            : goal === 'strength' || goal === 'muscle'
              ? (['teen', 'adult'] as AppMode[])
              : ALL
          ).filter((m) => !(m === 'senior' && split === 'ppl' && days >= 5)),
          blockWeeks: goal === 'strength' ? 6 : goal === 'muscle' ? 5 : 4,
          equipment: goal === 'strength' || goal === 'muscle' ? 'weights' : 'any',
        });
      }
    }
  }
  for (const days of [2, 3, 4, 5, 6]) {
    out.push({
      id: `mobilityBalance-fullBody-${days}`,
      goal: 'mobilityBalance',
      split: 'fullBody',
      daysPerWeek: days,
      minutes: 20,
      days: Array.from({ length: days }, (_, i) => (i % 2 ? FULL : MOBILITY)),
      modes: ALL,
      blockWeeks: 4,
      equipment: 'any',
    });
  }
  for (const days of [2, 3, 4]) {
    out.push({
      id: `seniorSteady-fullBody-${days}`,
      goal: 'seniorSteady',
      split: 'fullBody',
      daysPerWeek: days,
      minutes: 30,
      days: splitDays('fullBody', days),
      modes: ['senior'],
      blockWeeks: 4,
      equipment: 'any',
    });
  }
  return out;
}

export const READY_PLANS: ReadyPlan[] = build();
export const planById = (id: string | null | undefined) => READY_PLANS.find((p) => p.id === id);

/** A plan is only for the age modes it lists (QA R4-04: no adult plans by deep link). */
export const planAllowed = (plan: ReadyPlan | undefined, mode: AppMode | undefined) =>
  !!plan && mode !== 'child' && (!mode || plan.modes.includes(mode));

/** The plan this profile may follow: an id for another age mode counts as none. */
export const allowedPlan = (id: string | null | undefined, mode: AppMode | undefined) => {
  const plan = planById(id);
  return plan && planAllowed(plan, mode) ? plan : undefined;
};

export type PlanFilter = {
  days?: number;
  goal?: PlanGoal;
  split?: PlanSplit;
  maxMinutes?: number;
  muscleGroup?: MovementGroup;
  /** Only plans that work without weights. */
  noWeights?: boolean;
};

/** Plans for this age mode, filtered. 60+ sees the steadier plans first. */
export function findPlans(mode: AppMode, filter: PlanFilter = {}): ReadyPlan[] {
  if (mode === 'child') return [];
  return READY_PLANS.filter(
    (p) =>
      p.modes.includes(mode) &&
      (!filter.days || p.daysPerWeek === filter.days) &&
      (!filter.goal || p.goal === filter.goal) &&
      (!filter.split || p.split === filter.split) &&
      (!filter.maxMinutes || p.minutes <= filter.maxMinutes) &&
      // Plans with a day focused on that group, not every full-body plan (QA R5 P2).
      (!filter.muscleGroup ||
        p.days.some((d) => d.groups.length <= 2 && d.groups.includes(filter.muscleGroup!))) &&
      (!filter.noWeights || p.equipment === 'any'),
  ).sort(
    (a, b) =>
      (mode === 'senior'
        ? Number(b.goal === 'seniorSteady') - Number(a.goal === 'seniorSteady')
        : 0) ||
      a.daysPerWeek - b.daysPerWeek ||
      a.id.localeCompare(b.id),
  );
}

const MAIN_GOALS: Record<PlanGoal, MainGoal[]> = {
  shape: ['fitness'],
  muscle: ['look'],
  strength: ['strength'],
  weightLoss: ['lose_weight'],
  mobilityBalance: ['mobility', 'balance'],
  seniorSteady: ['strength', 'balance'],
};
const MUSCLE_GOAL: Record<PlanGoal, MuscleGoal> = {
  shape: 'strengthen',
  muscle: 'grow',
  strength: 'strengthen',
  weightLoss: 'firm',
  mobilityBalance: 'mobility',
  seniorSteady: 'strengthen',
};
const MOBILITY_AREAS = ['hips', 'upperBack', 'shoulders'];

/**
 * The muscles a plan day aims at (QA R5-05): the big movers first, not the
 * JSON order (legs gave "hips & inner thighs", pull "traps & biceps"). A
 * split day takes the whole list, a full-body day the first two.
 */
const DAY_TARGETS: Record<MovementGroup, string[]> = {
  legs: ['quads', 'hamstrings', 'glutes'],
  pull: ['lats', 'upperBack'],
  push: ['midChest', 'shoulders'],
  core: ['abs', 'obliques'],
};
export function dayTargets(group: MovementGroup, library: Exercise[], split: boolean): string[] {
  const trained = (key: string) =>
    library.some(
      (e) =>
        e.parts.includes('main') &&
        e.muscles.some((m) => m.role === 'primary' && muscleFamily(key).includes(m.muscleKey)),
    );
  const preferred = DAY_TARGETS[group].filter(trained);
  const list = preferred.length ? preferred : groupMuscles(group, library);
  return list.slice(0, split ? 3 : 2);
}

/**
 * The generator input for day N of a plan: the day's groups become the
 * targets (2 muscles per group), the plan sets goals and minutes. Safety
 * input (restrictions, pain, age, position, equipment) is untouched.
 */
export function planDayInput(
  input: GeneratorInput,
  plan: ReadyPlan,
  dayIndex: number,
  library: Exercise[],
): GeneratorInput {
  const day = plan.days[((dayIndex % plan.days.length) + plan.days.length) % plan.days.length];
  const goal = MUSCLE_GOAL[plan.goal];
  const split = day.groups.filter((g) => g !== 'mobility').length === 1;
  const muscleGoals = day.groups.flatMap((g) =>
    g === 'mobility'
      ? MOBILITY_AREAS.map((muscleKey) => ({ muscleKey, goal: 'mobility' as const }))
      : dayTargets(g, library, split).map((muscleKey) => ({ muscleKey, goal })),
  );
  const dayGroups = day.groups.filter((g): g is MovementGroup => g !== 'mobility');
  return {
    ...input,
    mainGoals: MAIN_GOALS[plan.goal],
    muscleGoals,
    minutes: plan.minutes,
    // A split day fills only its own groups; full-body days keep the balance.
    ...(dayGroups.length && dayGroups.length < 3 ? { dayGroups } : {}),
  };
}
