import type { Exercise } from '../exercises/types';
import type { AppMode, BodyBand } from '../profile/age';

import type { GeneratorInput } from './types';

const BAND_ORDER: BodyBand[] = ['kid', 'teen', 'young', 'adult', 'mid', 'senior', 'elder'];

export function bandRank(band: BodyBand): number {
  return BAND_ORDER.indexOf(band);
}

/** Conditions that keep every exercise at the lowest impact (SPEC §2.2 red flags). */
const LOW_IMPACT_ONLY = ['heart_condition', 'pregnant_postpartum', 'recent_surgery'];

export function userLevel(mode: AppMode): number {
  return mode === 'child' || mode === 'senior' ? 1 : 2;
}

/**
 * Why an exercise is not allowed for this user, or null when it is.
 * Every rule from SPEC §8 "Filter" plus the age and impact safety rules.
 */
export function blockReason(e: Exercise, input: GeneratorInput): string | null {
  if (e.status === 'retired') return 'retired';
  if (e.status !== 'released' && !input.includeDrafts) return 'not_released';
  if (!e.location.includes(input.location)) return 'location';
  if (!e.equipment.every((q) => input.equipment.includes(q))) return 'equipment';
  if (bandRank(input.band) < bandRank(e.minAgeBand)) return 'age';
  if (!e.positions.includes(input.position)) return 'position';
  const risks = new Set([...input.painAreas, ...input.conditions, ...input.restrictions]);
  if (e.contraindications.some((c) => risks.has(c))) return 'contraindication';
  if (input.mode === 'senior' && e.impact >= 2) return 'impact';
  if (input.conditions.some((c) => LOW_IMPACT_ONLY.includes(c)) && e.impact > 0) return 'impact';
  if (e.level > userLevel(input.mode) + 2) return 'level';
  return null;
}

export function safePool(input: GeneratorInput): Exercise[] {
  return input.library.filter((e) => blockReason(e, input) === null);
}

export function emphasisOn(e: Exercise, muscles: string[], role?: 'primary'): number {
  let best = 0;
  for (const m of e.muscles) {
    if (muscles.includes(m.muscleKey) && (!role || m.role === role))
      best = Math.max(best, m.emphasis);
  }
  return best;
}

export function isMachine(equipment: string): boolean {
  return equipment === 'machines' || equipment === 'cables';
}
