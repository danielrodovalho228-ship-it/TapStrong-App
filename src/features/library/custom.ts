import type { Exercise } from '../exercises/types';
import { JOINT_AREA } from '../movement/catalog';

import type { CustomExerciseData } from './store';

/**
 * A custom exercise as the generator sees it (B5). It gets the same pain and
 * restriction checks through the joints the person tagged: each tagged joint
 * rules it out for that area. Never programmed on its own (`custom`).
 */
export function customToExercise(c: CustomExerciseData): Exercise {
  const loaded = c.equipment.some((q) => q !== 'bands' && q !== 'mat');
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
    positions: ['standing', 'with_support', 'seated_only'],
    contraindications: [...new Set(c.joints.map((j) => JOINT_AREA[j]))],
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
    joints: c.joints.map((joint) => ({ joint, movement: 'custom', range: 'full' as const })),
    rangeLimit: [],
    rehab: false,
    media: { video: null, poster: null, provider: null },
  };
}

/** Only adults make their own exercises (improvements v1, B5). */
export const canCreateExercise = (mode: string) => mode === 'adult' || mode === 'senior';
