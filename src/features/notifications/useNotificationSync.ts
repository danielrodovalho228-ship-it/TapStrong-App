import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';

import { useAccountStore } from '../account/store';
import { currentPlan } from '../billing/rules';
import { useBillingStore } from '../billing/store';
import { pendingMorningChecks } from '../movement/progress';
import { useMovementPainStore } from '../movement/store';
import { currentBlockEnd, finished } from '../month/cycle';
import { modeOf } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';
import { blockAnchor, programStatus } from '../program/apply';
import { useProgramStore } from '../program/store';
import { streakToday } from '../workout/streak';
import { useWorkoutStore } from '../workout/store';

import { applyPlan, onNotificationTap } from './apply';
import { useTrainingDaysPerWeek } from '../program/useTrainingDays';

import { planNotifications } from './plan';

/** Keeps scheduled notifications in line with prefs, streak and language. */
export function useNotificationSync() {
  const prefs = useAccountStore((s) => s.notifications);
  const streak = useWorkoutStore((s) => s.streak);
  const daysPerWeek = useTrainingDaysPerWeek();
  const locale = useOnboardingStore((s) => s.locale);
  const entitlement = useBillingStore((s) => s.entitlement);
  const reports = useMovementPainStore((s) => s.reports);
  const workouts = useWorkoutStore((s) => s.workouts);
  const program = useProgramStore();
  const mode = modeOf(useOnboardingStore());
  const trialChargeAt =
    entitlement.status === 'trial' && entitlement.willRenew ? entitlement.trialEndsAt : null;

  const freePlan = currentPlan(entitlement, clock.now()) === 'free';

  useEffect(() => {
    const now = clock.now();
    const plan = planNotifications({
      prefs,
      daysPerWeek,
      startsOn: deviceWeekStart(),
      freePlan,
      streak: streakToday(streak, localDate(now), deviceWeekStart()),
      lastActive: streak.lastActive,
      now,
      trialChargeAt,
      morningChecks: pendingMorningChecks(reports),
      // Phase 26: the day the current block's summary opens.
      monthClosesOn: workouts.some(finished)
        ? currentBlockEnd(
            blockAnchor(program, workouts, localDate(now)),
            localDate(now),
            programStatus(program, workouts, localDate(now), mode).block.of,
          )
        : null,
    });
    void applyPlan(plan).catch(() => undefined);
    // Recomputed when a workout ends or the plan changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs,
    streak,
    daysPerWeek,
    locale,
    trialChargeAt,
    reports,
    freePlan,
    workouts.length,
    program.startedAt,
    program.planId,
    mode,
  ]);

  useEffect(() => onNotificationTap((url) => router.push(url as Href)), []);
}
