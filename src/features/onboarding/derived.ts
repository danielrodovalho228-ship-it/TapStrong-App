import { ageFrom, bandForAge, modeForAge, type AppMode, type BodyBand } from '../profile/age';

import { KIDS_MIN_AGE } from '@/lib/features';

import { activeMinorLock } from '../family/ownerIdentity';

import { hasRedFlag } from './safety';
import type { OnboardingData } from './store';

export type Derived = { age: number; mode: AppMode; band: BodyBand } | null;

/**
 * The mode used when no valid birth date is stored and no lock applies
 * (QA R8-02): the most restrictive supported mode, never adult.
 */
export const FALLBACK_MODE: AppMode = 'teen';

const validBirth = (s: Pick<OnboardingData, 'birthMonth' | 'birthYear'>) =>
  Number.isInteger(s.birthYear) &&
  Number.isInteger(s.birthMonth) &&
  s.birthMonth! >= 1 &&
  s.birthMonth! <= 12;

export function derive(s: Pick<OnboardingData, 'birthMonth' | 'birthYear'>): Derived {
  // A profile the secure record locks as a minor stays in its mode whatever
  // the stored birth date says: an edited, too-young or deleted date can't
  // switch a teen to adult mode (QA R7-03, R8-02). The lock only tightens.
  const lock = activeMinorLock();
  const age = validBirth(s) ? ageFrom({ year: s.birthYear!, month: s.birthMonth! }) : NaN;
  if (lock === 'teen') {
    const teen = Number.isFinite(age) ? Math.min(17, Math.max(13, age)) : 13;
    return { age: teen, mode: 'teen', band: 'teen' };
  }
  if (lock === 'under13') {
    const child = Number.isFinite(age) ? Math.min(12, Math.max(KIDS_MIN_AGE, age)) : KIDS_MIN_AGE;
    return { age: child, mode: 'child', band: 'kid' };
  }
  if (!Number.isFinite(age)) return null;
  const band = bandForAge(age);
  return band ? { age, mode: modeForAge(age), band } : null;
}

/** The mode to apply: the derived one, or the restrictive fallback (QA R8-02). */
export const modeOf = (s: Pick<OnboardingData, 'birthMonth' | 'birthYear'>): AppMode =>
  derive(s)?.mode ?? FALLBACK_MODE;

export type SummaryNote = 'bodyFat' | 'senior' | 'redFlag';

/**
 * Coach notes on the profile summary (mockup 05).
 * Body-fat language is adults only (SPEC §2.3: never for teens or children).
 */
export function summaryNotes(s: OnboardingData, mode: AppMode): SummaryNote[] {
  const notes: SummaryNote[] = [];
  if (hasRedFlag(s.painAreas, s.conditions)) notes.push('redFlag');
  const adult = mode === 'adult' || mode === 'senior';
  // "Look better" alone may mean more muscle: no body-fat callout (QA round 1).
  const wantsLeaner =
    s.mainGoals.includes('lose_weight') || s.muscleGoals.some((m) => m.goal === 'firm');
  if (adult && wantsLeaner) notes.push('bodyFat');
  if (mode === 'senior') notes.push('senior');
  return notes;
}
