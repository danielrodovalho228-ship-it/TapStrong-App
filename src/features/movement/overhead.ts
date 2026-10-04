import type { Exercise } from '../exercises/types';

/**
 * Shoulder above 90° or behind the back (Phase 32 A1, Daniel, Oct 4). With a
 * frozen shoulder or shoulder pain these never reach the person: not in the
 * program, not in "Shoulder today", not in the swap sheet. Read from the
 * database joint tags, never from a list of names: an overhead or
 * behind-the-back tag, or a full-range raise (flexion or abduction).
 */
export const BEYOND_SHOULDER = ['overhead', 'reach_behind'] as const;

export function aboveOrBehind(e: Pick<Exercise, 'joints'>): boolean {
  return e.joints.some(
    (j) =>
      j.joint === 'shoulder' &&
      ((BEYOND_SHOULDER as readonly string[]).includes(j.movement) ||
        ((j.movement === 'flexion' || j.movement === 'abduction') && j.range === 'full')),
  );
}
