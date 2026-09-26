import { useEffect } from 'react';

import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';

import { useAccountStore } from '../account/store';
import { useOnboardingStore } from '../onboarding/store';
import { streakToday } from '../workout/streak';
import { useWorkoutStore } from '../workout/store';

import { applyPlan } from './apply';
import { planNotifications } from './plan';

/** Keeps scheduled notifications in line with prefs, streak and language. */
export function useNotificationSync() {
  const prefs = useAccountStore((s) => s.notifications);
  const streak = useWorkoutStore((s) => s.streak);
  const daysPerWeek = useOnboardingStore((s) => s.daysPerWeek);
  const locale = useOnboardingStore((s) => s.locale);

  useEffect(() => {
    const now = clock.now();
    const plan = planNotifications({
      prefs,
      daysPerWeek,
      streak: streakToday(streak, localDate(now), deviceWeekStart()),
      lastActive: streak.lastActive,
      now,
    });
    void applyPlan(plan).catch(() => undefined);
  }, [prefs, streak, daysPerWeek, locale]);
}
