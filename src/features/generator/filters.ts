import type { Exercise } from '../exercises/types';
import { limitAreas, movementVerdict } from '../movement/rules';
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
  if (e.rehab && !input.rehab) return 'rehab_only';
  // Areas with a "Movement that hurts" report are judged movement by movement.
  const byMovement = limitAreas(input.movementLimits);
  const risks = new Set(
    [...input.painAreas, ...input.conditions, ...input.restrictions].filter(
      (r) => !byMovement.has(r),
    ),
  );
  if (e.contraindications.some((c) => risks.has(c))) return 'contraindication';
  if (rangeFor(e, input) === 'blocked') return 'painful_movement';
  if (input.mode === 'senior' && e.impact >= 2) return 'impact';
  if (input.conditions.some((c) => LOW_IMPACT_ONLY.includes(c)) && e.impact > 0) return 'impact';
  if (e.level > userLevel(input.mode) + 2) return 'level';
  return null;
}

/** How an exercise must be done given the movement limits (SPEC §8 "Movement that hurts"). */
export function rangeFor(e: Exercise, input: GeneratorInput) {
  if (!input.movementLimits?.length) return 'ok' as const;
  return movementVerdict(e, input.movementLimits, {
    allowReducedRange: input.allowReducedRange ?? true,
  });
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
