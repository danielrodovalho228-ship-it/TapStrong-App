import { isMachineItem } from '../equipment/catalog';
import type { Exercise } from '../exercises/types';
import { JOINT_AREA } from '../movement/catalog';
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
  // The person's own exercise (B5) skips the release check, never the safety ones.
  if (!e.custom && e.status !== 'released' && !input.includeDrafts) return 'not_released';
  if (!e.location.includes(input.location)) return 'location';
  if (!e.equipment.every((q) => input.equipment.includes(q))) return 'equipment';
  if (bandRank(input.band) < bandRank(e.minAgeBand)) return 'age';
  if (isKidMove(e) && input.mode !== 'child') return 'age';
  if (!e.positions.includes(input.position)) return 'position';
  if (e.rehab && !input.rehab) return 'rehab_only';
  // Areas with a "Movement that hurts" report are judged movement by movement.
  const byMovement = limitAreas(input.movementLimits);
  const risks = new Set([
    ...[...input.painAreas, ...input.conditions, ...input.restrictions].filter(
      (r) => !byMovement.has(r),
    ),
    ...(input.painToday ?? []),
  ]);
  if (e.contraindications.some((c) => risks.has(c))) return 'contraindication';
  // Red flags ("Doctor first") and a sharp-pain stop today leave out every
  // exercise that moves the joint, not only the ones tagged with the area
  // (QA C-02, R2-02). Dull pain today leaves out moves through the joint but
  // keeps pain-free holds, so a safe swap is still possible (QA A-05).
  const hard = [...(input.hardRestrictions ?? []), ...(input.stoppedToday ?? [])];
  if (
    hard.length &&
    (e.contraindications.some((c) => hard.includes(c)) ||
      e.joints.some((j) => hard.includes(JOINT_AREA[j.joint])) ||
      // A standing single-leg stance loads the knee too (QA R5-01).
      (hard.includes('knee') &&
        e.joints.some((j) => j.joint === 'ankle' && j.movement === 'balance')))
  ) {
    return 'contraindication';
  }
  const dull = input.painToday ?? [];
  if (
    dull.length &&
    e.joints.some((j) => j.range !== 'isometric' && dull.includes(JOINT_AREA[j.joint]))
  ) {
    return 'contraindication';
  }
  if (rangeFor(e, input) === 'blocked') return 'painful_movement';
  if (input.mode === 'senior' && e.impact >= 2) return 'impact';
  // Kneeling (getting down to the floor and back up) is not a 60+ default (QA R5-01).
  if (input.mode === 'senior' && e.joints.some((j) => j.joint === 'knee' && j.movement === 'kneel'))
    return 'position';
  if (input.conditions.some((c) => LOW_IMPACT_ONLY.includes(c)) && e.impact > 0) return 'impact';
  // Experience (Settings, D4): new people stay closer to their level.
  const reach = input.experience === 'new' ? 1 : input.experience === 'experienced' ? 3 : 2;
  if (e.level > userLevel(input.mode) + reach) return 'level';
  return null;
}

/**
 * The move loads a joint with a restriction, a pain area or a "Movement that
 * hurts" report: it gets a light dose and no ramp-up (QA R2-07).
 */
export function needsJointCare(
  e: Pick<Exercise, 'joints'>,
  input: Partial<
    Pick<GeneratorInput, 'restrictions' | 'painAreas' | 'movementLimits' | 'stoppedToday'>
  >,
): boolean {
  const areas = new Set([
    ...(input.restrictions ?? []),
    ...(input.stoppedToday ?? []),
    ...(input.painAreas ?? []),
    ...(input.movementLimits ?? []).map((l) => l.area),
  ]);
  return areas.size > 0 && e.joints.some((j) => areas.has(JOINT_AREA[j.joint]));
}

/** Kid game moves ("Penguin march") are for kids only (QA R2-11). */
export const isKidMove = (e: Pick<Exercise, 'slug'>) => e.slug.startsWith('kid_');

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

/** What the generator and swap sheet may program: custom exercises never (B5). */
export function programmablePool(input: GeneratorInput): Exercise[] {
  return safePool(input).filter((e) => !e.custom);
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
  return isMachineItem(equipment);
}
