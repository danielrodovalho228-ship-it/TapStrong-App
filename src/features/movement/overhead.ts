import type { Exercise } from '../exercises/types';

/**
 * Shoulder above 90° or behind the back (Phase 32 A1, Daniel, Oct 4). With a
 * frozen shoulder or shoulder pain these never reach the person: not in the
 * program, not in "Shoulder today", not in the swap sheet. Read from the
 * database joint tags, never from a list of names: an overhead or
 * behind-the-back tag, or a full-range raise (flexion or abduction).
 */
export const BEYOND_SHOULDER = ['overhead', 'reach_behind'] as const;

export function aboveOrBehind(
  e: Pick<Exercise, 'joints'>,
  /**
   * Behind the back is allowed (Daniel, Phase 32 answer 1): only in the
   * shoulder program's own sessions, after the physio said "Yes". Overhead
   * never.
   */
  o: { behindOk?: boolean } = {},
): boolean {
  const beyond = o.behindOk ? ['overhead'] : (BEYOND_SHOULDER as readonly string[]);
  return e.joints.some(
    (j) =>
      j.joint === 'shoulder' &&
      (beyond.includes(j.movement) ||
        ((j.movement === 'flexion' || j.movement === 'abduction') && j.range === 'full')),
  );
}
