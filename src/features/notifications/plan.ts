import { localDate, type WeekStartDay } from '@/lib/dates';

import type { NotificationPrefs } from '../account/store';
import { FREE_WORKOUTS_PER_WEEK, trialReminderAt } from '../billing/rules';
import { plannedOffsets } from '../program/week';

/**
 * Local notifications (SPEC §3: expo-notifications): workout reminders on
 * training days, and one "streak saver" nudge when the streak is alive and
 * nothing is logged today. Pure plan, applied by `apply.ts`.
 */
export type PlannedNotification =
  | {
      id: string;
      kind: 'reminder';
      /** 1 = Sunday … 7 = Saturday (expo-notifications weekly trigger). */
      weekday: number;
      hour: number;
      minute: number;
      /** Free plan, a day past the weekly free workouts: suggest short mobility. */
      mobility?: boolean;
    }
  | { id: string; kind: 'streak_saver'; date: Date; streak: number }
  /** Honest billing (SPEC §2.5): a reminder before a trial turns into a charge. */
  | { id: string; kind: 'trial'; date: Date; chargeOn: string }
  /** Pain traffic light (SPEC §8): the morning after a workout, rate the painful area. */
  | {
      id: string;
      kind: 'movement_check';
      date: Date;
      reportId: string;
      area: string;
      workoutId: string;
    };

/** A workout rated right after, still waiting for its morning check. */
export type PendingMorningCheck = {
  reportId: string;
  area: string;
  workoutId: string;
  afterAt: string;
};

/** Morning checks go out at 8:30 local time the day after the workout. */
export const MORNING_CHECK = { hour: 8, minute: 30 };

/**
 * Training days for "N days a week", as JS weekdays (0 = Sunday): the same
 * days the week strip plans, from the phone's week start (QA R4 P2: one
 * source of truth).
 */
export function trainingWeekdays(daysPerWeek: number | undefined, startsOn: WeekStartDay = 0) {
  return plannedOffsets(daysPerWeek ?? 3)
    .map((o) => (startsOn + o) % 7)
    .sort((x, y) => x - y);
}
/** Sunday-start table, kept for callers that don't know the week start. */
export const TRAINING_DAYS: Record<number, number[]> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((n) => [n, trainingWeekdays(n, 0)]),
);

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return {
    hour: Number.isInteger(h) && h >= 0 && h < 24 ? h : 18,
    minute: Number.isInteger(m) && m >= 0 && m < 60 ? m : 0,
  };
}

export function planNotifications(input: {
  prefs: NotificationPrefs;
  daysPerWeek: number | undefined;
  /** The phone's first day of the week, as the week strip uses it. */
  startsOn?: WeekStartDay;
  /** On the free plan (a weekly workout limit). */
  freePlan?: boolean;
  /** Streak as it stands today (0 = none to save). */
  streak: number;
  lastActive: string | null;
  now: Date;
  /** Trial end when it will renew into a charge; null otherwise. */
  trialChargeAt?: string | null;
  morningChecks?: PendingMorningCheck[];
}): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const { prefs, now } = input;

  if (prefs.reminders) {
    const { hour, minute } = parseTime(prefs.reminderTime);
    const days = prefs.reminderDays?.length
      ? prefs.reminderDays
      : trainingWeekdays(input.daysPerWeek, input.startsOn);
    for (const day of days) {
      // Free plan with more days than free workouts (Daniel, Phase 16): the
      // extra days' reminders suggest the free short mobility, not a paywall.
      const order = (d: number) => (d - (input.startsOn ?? 0) + 7) % 7;
      const rank = [...days].sort((a, b) => order(a) - order(b)).indexOf(day);
      const mobility = !!input.freePlan && rank >= FREE_WORKOUTS_PER_WEEK;
      out.push({
        id: `reminder-${day}`,
        kind: 'reminder',
        weekday: day + 1,
        hour,
        minute,
        ...(mobility ? { mobility: true } : {}),
      });
    }
  }

  if (prefs.streakSaver && input.streak > 0) {
    const { hour, minute } = parseTime(prefs.streakSaverTime);
    const today = new Date(now);
    today.setHours(hour, minute, 0, 0);
    const activeToday = input.lastActive === localDate(now);
    // Today if nothing is logged yet and the time is still ahead; else tomorrow.
    const date = !activeToday && today > now ? today : new Date(today.getTime() + 86_400_000);
    out.push({ id: 'streak-saver', kind: 'streak_saver', date, streak: input.streak });
  }

  // Always scheduled while a trial will renew, whatever the other toggles say.
  const reminder = trialReminderAt(input.trialChargeAt ?? null, now);
  if (reminder && input.trialChargeAt) {
    out.push({
      id: 'trial-reminder',
      kind: 'trial',
      date: reminder,
      chargeOn: input.trialChargeAt,
    });
  }

  // Part of a plan the person started, so not tied to the reminder toggles.
  for (const c of input.morningChecks ?? []) {
    const date = new Date(c.afterAt);
    date.setDate(date.getDate() + 1);
    date.setHours(MORNING_CHECK.hour, MORNING_CHECK.minute, 0, 0);
    if (date > now) {
      out.push({
        id: `movement-check-${c.reportId}`,
        kind: 'movement_check',
        date,
        reportId: c.reportId,
        area: c.area,
        workoutId: c.workoutId,
      });
    }
  }
  return out;
}
