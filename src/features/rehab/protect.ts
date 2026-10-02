import type { GeneratorInput } from '../generator/types';
import type { MovementLimit } from '../movement/rules';
import { daysBetween, type LocalDate } from '@/lib/dates';

import { programById } from './programs';
import type { ProgramRun } from './store';

/**
 * "Protected shoulder" mode (Phase 30 addendum §6.4). While a care program
 * runs, the main workout protects its joint:
 * - not cleared by the physio for shoulder and arm training (or not answered
 *   yet): every exercise that moves the joint is left out; legs, core and the
 *   rest stay (as a red flag does);
 * - cleared: overhead and behind-the-back moves (overhead press, pull-up,
 *   pulldown, dips) are left out, side raises go up to shoulder height when
 *   the exercise allows a shorter range, and every move of the joint gets a
 *   light dose (needsJointCare).
 * After the physio releases the program (§6.5), the cleared rules stay for
 * two more weeks so the main plan comes back gradually.
 * Which exercise uses which movement comes from the database tags.
 */
export const SHOULDER_MOVES = [
  'flexion',
  'abduction',
  'reach_behind',
  'external_rotation',
  'internal_rotation',
  'overhead',
  'push',
  'pull',
  'carry',
] as const;

/** Days the cleared rules stay after the release (§6.5 "aos poucos"). */
export const RETURN_DAYS = 14;

export type CareMode = 'off' | 'protected' | 'returning' | 'none';

export type CareProtection = {
  /** Areas whose every moving exercise is left out. */
  hard: string[];
  limits: MovementLimit[];
};

const limit = (painful: string[], score: number): MovementLimit => ({
  area: 'shoulder',
  joints: ['shoulder'],
  painful: painful.map((m) => `shoulder.${m}` as const),
  painFree: SHOULDER_MOVES.filter((m) => !painful.includes(m)).map((m) => `shoulder.${m}` as const),
  score,
});

/** Never, not even in a shorter range (above 5: no reduced range). */
const NEVER = limit(['overhead', 'reach_behind'], 6);
/** Up to shoulder height when the exercise allows a shorter range. */
const SHOULDER_HEIGHT = limit(['abduction'], 3);

/** How the main workout treats one program run today. */
export function careMode(run: ProgramRun, today: LocalDate): CareMode {
  if (run.releasedAt)
    return daysBetween(run.releasedAt, today) < RETURN_DAYS ? 'returning' : 'none';
  return run.cleared === true ? 'protected' : 'off';
}

/** What every running care program adds to the main workout's safety input. */
export function careProtection(runs: Record<string, ProgramRun>, today: LocalDate): CareProtection {
  const hard = new Set<string>();
  const limits: MovementLimit[] = [];
  for (const [id, run] of Object.entries(runs)) {
    const area = programById(id)?.area;
    if (area !== 'shoulder') continue;
    const mode = careMode(run, today);
    if (mode === 'off') hard.add(area);
    else if (mode !== 'none' && !limits.length) limits.push(NEVER, SHOULDER_HEIGHT);
  }
  return { hard: [...hard], limits };
}

/** The main workout's input with the care rules on top; remembers what it added. */
export function withCare(input: GeneratorInput, care: CareProtection): GeneratorInput {
  if (!care.hard.length && !care.limits.length) return input;
  const own = input.hardRestrictions ?? [];
  const hard = care.hard.filter((a) => !own.includes(a));
  return {
    ...input,
    hardRestrictions: [...own, ...hard],
    movementLimits: [...(input.movementLimits ?? []), ...care.limits],
    care: { hard, limits: care.limits },
  };
}

/** The input without the care rules: the program's own sessions train the joint on purpose. */
export function withoutCare(input: GeneratorInput): GeneratorInput {
  const care = input.care;
  if (!care) return input;
  return {
    ...input,
    hardRestrictions: (input.hardRestrictions ?? []).filter((a) => !care.hard.includes(a)),
    movementLimits: (input.movementLimits ?? []).filter((l) => !care.limits.includes(l)),
    care: undefined,
  };
}
