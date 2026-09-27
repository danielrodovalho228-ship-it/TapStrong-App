import type { Exercise } from '../exercises/types';
import { getAlternatives } from '../generator';
import type { GeneratedSession, GeneratorInput } from '../generator/types';

import type { PainReportArea, PainType, Side } from './types';

/** Where it hurts — chips on mockup 21. Areas match safety-check keys. */
export const PAIN_SPOTS: { key: string; area: PainReportArea; side?: Side }[] = [
  { key: 'shoulder_right', area: 'shoulder', side: 'right' },
  { key: 'shoulder_left', area: 'shoulder', side: 'left' },
  { key: 'neck', area: 'neck' },
  { key: 'elbow_wrist', area: 'elbow_wrist' },
  { key: 'lower_back', area: 'lower_back' },
  { key: 'hip', area: 'hip' },
  { key: 'knee', area: 'knee' },
  { key: 'ankle_foot', area: 'ankle_foot' },
  { key: 'other', area: 'other' },
];

export const PAIN_TYPES: PainType[] = ['sharp', 'dull', 'tired'];

/**
 * SPEC §2.2: sharp pain stops today's workout; dull pain gets a safe swap
 * plus a saved restriction; "just tired" keeps going after a longer rest.
 */
export type PainPlan = 'stop' | 'swap' | 'rest';

export const planFor = (type: PainType): PainPlan =>
  type === 'sharp' ? 'stop' : type === 'dull' ? 'swap' : 'rest';

/** Generator input with the painful area added as a restriction. */
export function withRestriction(input: GeneratorInput, area: PainReportArea): GeneratorInput {
  if (area === 'other') return input;
  return {
    ...input,
    restrictions: input.restrictions.includes(area)
      ? input.restrictions
      : [...input.restrictions, area],
    // Pain right now beats a movement report's pain-free list (QA A-05).
    painToday: [...new Set([...(input.painToday ?? []), area])],
  };
}

/** The safest swap for the item that hurt: same muscle, spares the area. */
export function painSwap(
  session: GeneratedSession,
  itemId: string,
  input: GeneratorInput,
  area: PainReportArea,
): Exercise | null {
  return getAlternatives(session, itemId, withRestriction(input, area), { limit: 1 })[0] ?? null;
}
