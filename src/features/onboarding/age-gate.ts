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

import { kidsUnder13Enabled, LAUNCH_MIN_AGE } from '@/lib/features';

import type { Who } from './options';

export type ChildLock = 'under13' | 'teen';

/** The lock for a managed profile: consented under-13 profiles vs teen profiles. */
export const childLockFor = (profile: { kind: string; consentAt?: string } | null) =>
  profile?.kind === 'child' ? (profile.consentAt ? 'under13' : 'teen') : undefined;

export type AgeGateResult =
  | { status: 'ok'; age: number; mode: AppMode; band: BodyBand }
  /** Under 9: not supported. */
  | { status: 'too_young'; age: number }
  /** Under 13 answering for themselves: a parent must set it up. */
  | { status: 'ask_parent'; age: number }
  /** A parent adding a child under 13: needs the guardian consent flow (Phase 6). */
  | { status: 'guardian_consent'; age: number }
  | { status: 'child_too_old'; age: number }
  /** A consented child profile stays in kids mode until they really turn 13 (QA B-01). */
  | { status: 'child_locked'; age: number }
  /** A teen profile stays 13–17: moving it under 13 would skip parental consent (QA R2-01). */
  | { status: 'teen_locked'; age: number }
  | { status: 'parent_too_young'; age: number }
  /**
   * Kids under 13 are off (launch, Phase 12): someone under 13 answering for
   * themselves gets the neutral "13 and up" stop, locked on the device.
   */
  | { status: 'under_min'; age: number }
  /** Kids under 13 are off: a parent can't add a child profile under 13 yet. */
  | { status: 'child_unavailable'; age: number };

/** Routes the age gate (mockup 02, SPEC §2.3 and §8 "Age & mode"). */
export function evaluateAgeGate(
  who: Who,
  birth: YearMonth,
  today: YearMonth = currentYearMonth(),
  /** The parent's verified consent is on file for this child profile (Phase 6). */
  consented = false,
  /**
   * A managed child or teen profile (QA B-01, R2-01): an under-13 profile
   * (created with consent) can't move to 13+, and a teen profile stays 13–17.
   */
  lock?: ChildLock,
): AgeGateResult {
  const age = ageFrom(birth, today);
  if (lock === 'under13' && age >= 13) return { status: 'child_locked', age };
  if (lock === 'teen' && age < 13) return { status: 'teen_locked', age };
  if (!kidsUnder13Enabled() && age < LAUNCH_MIN_AGE) {
    if (who === 'child') return { status: 'child_unavailable', age };
    if (who === 'me') return { status: 'under_min', age };
  }
  if (age < MIN_AGE) return { status: 'too_young', age };
  if (who === 'child' && age >= 18) return { status: 'child_too_old', age };
  if (who === 'parent' && age < 18) return { status: 'parent_too_young', age };
  if (age < 13 && !(who === 'child' && consented)) {
    return { status: who === 'child' ? 'guardian_consent' : 'ask_parent', age };
  }
  return { status: 'ok', age, mode: modeForAge(age), band: bandForAge(age)! };
}

/** The message for a gate result; with kids under 13 off it never mentions them (QA round 3). */
export function whoErrorKey(status: AgeGateResult['status']) {
  return status === 'teen_locked' && !kidsUnder13Enabled()
    ? ('who.errors.teen_lockedTeens' as const)
    : (`who.errors.${status as 'teen_locked'}` as const);
}
