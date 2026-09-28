import { ageFrom, bandForAge, modeForAge, type AppMode, type BodyBand } from '../profile/age';

import { activeMinorLock } from '../family/ownerIdentity';

import { hasRedFlag } from './safety';
import type { OnboardingData } from './store';

export type Derived = { age: number; mode: AppMode; band: BodyBand } | null;

export function derive(s: Pick<OnboardingData, 'birthMonth' | 'birthYear'>): Derived {
  if (!s.birthMonth || !s.birthYear) return null;
  const age = ageFrom({ year: s.birthYear, month: s.birthMonth });
  // A profile the secure record locks as a minor stays in its mode whatever
  // the stored birth year says: an edited year can't switch a teen to adult
  // mode (QA R7-03). The lock only ever tightens.
  const lock = activeMinorLock();
  if (lock === 'teen' && age >= 18) return { age: 17, mode: 'teen', band: 'teen' };
  if (lock === 'under13' && age >= 13) return { age: 12, mode: 'child', band: 'kid' };
  const band = bandForAge(age);
  return band ? { age, mode: modeForAge(age), band } : null;
}

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
