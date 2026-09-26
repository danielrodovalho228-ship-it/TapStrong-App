import {
  ageFrom,
  bandForAge,
  currentYearMonth,
  MIN_AGE,
  modeForAge,
  type AppMode,
  type BodyBand,
  type YearMonth,
} from '../profile/age';

import type { Who } from './options';

export type AgeGateResult =
  | { status: 'ok'; age: number; mode: AppMode; band: BodyBand }
  /** Under 9: not supported. */
  | { status: 'too_young'; age: number }
  /** Under 13 answering for themselves: a parent must set it up. */
  | { status: 'ask_parent'; age: number }
  /** A parent adding a child under 13: needs the guardian consent flow (Phase 6). */
  | { status: 'guardian_consent'; age: number }
  | { status: 'child_too_old'; age: number }
  | { status: 'parent_too_young'; age: number };

/** Routes the age gate (mockup 02, SPEC §2.3 and §8 "Age & mode"). */
export function evaluateAgeGate(
  who: Who,
  birth: YearMonth,
  today: YearMonth = currentYearMonth(),
): AgeGateResult {
  const age = ageFrom(birth, today);
  if (age < MIN_AGE) return { status: 'too_young', age };
  if (who === 'child' && age >= 18) return { status: 'child_too_old', age };
  if (who === 'parent' && age < 18) return { status: 'parent_too_young', age };
  if (age < 13) return { status: who === 'child' ? 'guardian_consent' : 'ask_parent', age };
  return { status: 'ok', age, mode: modeForAge(age), band: bandForAge(age)! };
}
