import { EQUIPMENT_GROUPS } from '../equipment/catalog';
import type { Exercise } from '../exercises/types';
import { JOINT_AREA, type JointKey } from '../movement/catalog';
import type { Position } from '../onboarding/options';

import type { CustomExerciseData } from './store';

/**
 * Joints each main muscle moves (QA R4-03). A custom exercise always carries
 * the joints of its main muscles, plus any the person adds, so restrictions,
 * pain and "stop today" rule it out like a coach-tagged exercise.
 */
export const MUSCLE_JOINTS: Record<string, JointKey[]> = {
  chest: ['shoulder', 'elbow'],
  upperChest: ['shoulder', 'elbow'],
  midChest: ['shoulder', 'elbow'],
  lowerChest: ['shoulder', 'elbow'],
  shoulders: ['shoulder'],
  rearDelts: ['shoulder'],
  rotatorCuff: ['shoulder'],
  traps: ['shoulder', 'neck'],
  upperBack: ['shoulder', 'elbow'],
  lats: ['shoulder', 'elbow'],
  biceps: ['elbow'],
  triceps: ['elbow'],
  forearms: ['wrist', 'elbow'],
  abs: ['lower_back'],
  upperAbs: ['lower_back'],
  lowerAbs: ['lower_back'],
  obliques: ['lower_back'],
  lowerBack: ['lower_back'],
  hips: ['hip'],
  adductors: ['hip'],
  glutes: ['hip', 'knee'],
  quads: ['knee'],
  knees: ['knee'],
  hamstrings: ['knee', 'hip'],
  calves: ['ankle', 'knee'],
  shins: ['ankle'],
};

/** Free weights are held in both hands unless proven otherwise: no "with support" (R3-09). */
const FREE_WEIGHTS: readonly string[] = EQUIPMENT_GROUPS.freeWeights;
export const usesFreeWeights = (equipment: readonly string[]) =>
  equipment.some((q) => FREE_WEIGHTS.includes(q));

export function customJoints(c: Pick<CustomExerciseData, 'primary' | 'joints'>): JointKey[] {
  return [...new Set([...c.primary.flatMap((m) => MUSCLE_JOINTS[m] ?? []), ...c.joints])];
}

/** Standing only unless the person picks more; never "with support" with free weights. */
export function customPositions(
  c: Pick<CustomExerciseData, 'positions' | 'equipment'>,
): Position[] {
  const picked: Position[] = c.positions?.length ? c.positions : ['standing'];
  const allowed = usesFreeWeights(c.equipment)
    ? picked.filter((p) => p !== 'with_support')
    : picked;
  return allowed.length ? allowed : ['standing'];
}

/**
 * A custom exercise as the generator sees it (B5). It gets the same pain and
 * restriction checks through its joints (main muscles' joints plus the ones
 * the person tagged): each joint rules it out for that area. Never
 * programmed on its own (`custom`).
 */
export function customToExercise(c: CustomExerciseData): Exercise {
  const loaded = c.equipment.some((q) => q !== 'bands' && q !== 'mat' && !q.includes('band'));
  const joints = customJoints(c);
  return {
    id: c.id,
    slug: c.id,
    nameKey: '',
    cuesKey: '',
    customName: c.name,
    custom: true,
    equipment: c.equipment as Exercise['equipment'],
    location: ['home', 'gym', 'outdoors'],
    level: 2,
    minAgeBand: 'young',
    positions: customPositions(c),
    contraindications: [...new Set(joints.map((j) => JOINT_AREA[j]))],
    pattern: 'core_stability',
    parts: ['main'],
    dose: 'reps',
    loaded,
    unilateral: false,
    impact: 0,
    status: 'draft',
    muscles: [
      ...c.primary.map((muscleKey) => ({ muscleKey, role: 'primary' as const, emphasis: 1 })),
      ...c.secondary.map((muscleKey) => ({ muscleKey, role: 'secondary' as const, emphasis: 0.5 })),
    ],
    joints: joints.map((joint) => ({ joint, movement: 'custom', range: 'full' as const })),
    rangeLimit: [],
    rehab: false,
    media: { video: null, poster: null, provider: null },
  };
}

/** Only adults make their own exercises (improvements v1, B5). */
export const canCreateExercise = (mode: string) => mode === 'adult' || mode === 'senior';
