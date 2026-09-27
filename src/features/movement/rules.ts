import type { Exercise } from '../exercises/types';

import type { JointKey, MovementKey } from './catalog';
import { movementKey } from './catalog';

/**
 * A movement-level limit from a "Movement that hurts" report. It replaces the
 * whole-area restriction for that area: exercises that only use pain-free
 * movements of the joint stay in the plan.
 */
export type MovementLimit = {
  area: string;
  joints: JointKey[];
  painful: MovementKey[];
  painFree: MovementKey[];
  /** Latest pain score, 0–10. */
  score: number;
  /** Recovery plan phase (1–3); phase 1 is holds only (QA R2-07). */
  phase?: 1 | 2 | 3;
};

/** From this score up the joint is too irritable: every movement of it is left out. */
export const IRRITABLE_SCORE = 7;
/** Reduced range and gentle holds only while pain stays in the yellow zone or below. */
export const REDUCED_RANGE_MAX_SCORE = 5;

export type MovementVerdict = 'ok' | 'isometric' | 'reduced' | 'blocked';
const RANK: Record<MovementVerdict, number> = { ok: 0, isometric: 1, reduced: 2, blocked: 3 };

export type VerdictOptions = {
  /** Regular workouts and recovery phase 3 allow a shorter range; phases 1–2 do not. */
  allowReducedRange: boolean;
};

/**
 * What an exercise may do given the limits, in the SPEC order:
 * 1. an exercise that needs a painful movement is left out;
 * 2. pain-free movements stay;
 * 3. a shorter range is used when the exercise allows it for that movement.
 * Movements the person did not rate count as painful (safer default). A hold
 * without moving (isometric) in the painful direction is allowed while pain
 * is low: that is how physical therapists start (recovery phase 1).
 */
export function movementVerdict(
  e: Pick<Exercise, 'joints' | 'rangeLimit' | 'contraindications'>,
  limits: MovementLimit[],
  opts: VerdictOptions,
): MovementVerdict {
  let worst: MovementVerdict = 'ok';
  const raise = (v: MovementVerdict) => {
    if (RANK[v] > RANK[worst]) worst = v;
  };
  for (const limit of limits) {
    // Recovery phase 1 uses only holds cleared for the area, in a workout,
    // a recovery session or a swap alike (QA R3-07).
    if (limit.phase === 1 && e.contraindications.includes(limit.area)) {
      raise('blocked');
      continue;
    }
    const uses = e.joints.filter((j) => limit.joints.includes(j.joint));
    if (!uses.length) {
      // Ruled out for the area but untagged for its joints: cannot judge, keep it out.
      if (e.contraindications.includes(limit.area)) raise('blocked');
      continue;
    }
    if (limit.score >= IRRITABLE_SCORE) {
      raise('blocked');
      continue;
    }
    for (const use of uses) {
      const key = movementKey(use.joint, use.movement);
      if (limit.painFree.includes(key)) continue;
      const lowPain = limit.score <= REDUCED_RANGE_MAX_SCORE;
      // While the recovery plan is in phase 1 (holds only), a painful movement
      // is never used, not even in a shorter range (QA R2-07).
      const reducedOk = opts.allowReducedRange && limit.phase !== 1;
      if (use.range === 'isometric' && lowPain) raise('isometric');
      else if (reducedOk && lowPain && e.rangeLimit.includes(key)) raise('reduced');
      else raise('blocked');
    }
  }
  return worst;
}

/** Areas handled movement by movement instead of as a whole. */
export const limitAreas = (limits: MovementLimit[] | undefined) =>
  new Set((limits ?? []).map((l) => l.area));
