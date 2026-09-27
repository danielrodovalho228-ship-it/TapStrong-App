import { localDate } from '@/lib/dates';

import type { NotificationPrefs } from '../account/store';
import { trialReminderAt } from '../billing/rules';

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

/** Training days for "N days a week", as JS weekdays (0 = Sunday). */
export const TRAINING_DAYS: Record<number, number[]> = {
  1: [3],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

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
    for (const day of TRAINING_DAYS[input.daysPerWeek ?? 3] ?? TRAINING_DAYS[3]) {
      out.push({ id: `reminder-${day}`, kind: 'reminder', weekday: day + 1, hour, minute });
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
