import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ageFrom, currentYearMonth, type YearMonth } from '@/features/profile/age';
import { minAge } from '@/lib/features';
import { kvStorage } from '@/lib/storage';

/**
 * Neutral age screen (Phase 12 store rule, narrowed in QA R3-01).
 *
 * When someone under 13 answers for themselves in the self-signup "Me" flow,
 * before any account exists, this phone keeps saying "13 and up": going back
 * and typing another birth date doesn't unlock it. The lock
 *  - never applies to family profiles or to an edit of a finished profile
 *    (see `ageLockApplies`);
 *  - remembers the birth date that was entered and lifts by itself once that
 *    date turns 13;
 *  - is kept apart from the onboarding answers, so "Start over" never clears
 *    it. Support can help with a mistyped date.
 */
type State = {
  birth: YearMonth | null;
  block: (birth: YearMonth) => void;
  reset: () => void;
};

export const useAgeBlockStore = create<State>()(
  persist(
    (set) => ({
      birth: null,
      block: (birth) => set({ birth }),
      reset: () => set({ birth: null }),
    }),
    {
      name: 'age-block',
      version: 2,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ birth }) => ({ birth }),
      // Version 1 kept a bare `blocked` flag with no date and no expiry: it
      // can't be expired, and it locked family profiles too, so it's dropped.
      migrate: () => ({ birth: null }),
    },
  ),
);

/** True while the stored self-signup birth date is still under the minimum age. */
export function isAgeBlocked(
  birth: YearMonth | null,
  today: YearMonth = currentYearMonth(),
): boolean {
  return !!birth && ageFrom(birth, today) < minAge();
}

/**
 * The lock is only for the self-signup "Me" flow before an account exists:
 * not while editing a finished profile, not once an account is saved, and
 * never for a profile an adult owner creates in Family.
 */
export function ageLockApplies(ctx: {
  who: string;
  editing: boolean;
  accountSaved: boolean;
  familyProfile: boolean;
}): boolean {
  return ctx.who === 'me' && !ctx.editing && !ctx.accountSaved && !ctx.familyProfile;
}
