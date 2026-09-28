import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

/**
 * Account state kept on the phone (SPEC §8 "Paywall & account"). The session
 * itself lives in Supabase Auth storage; this store remembers what the UI
 * needs: whether progress is saved, the stable profile id used for sync, a
 * referral code picked up from a link, and notification choices.
 */
export type NotificationPrefs = {
  reminders: boolean;
  /** 24 h "HH:MM", local time. */
  reminderTime: string;
  /** Reminder days as JS weekdays (0 = Sunday); unset = the plan's training days (D4). */
  reminderDays?: number[];
  streakSaver: boolean;
  streakSaverTime: string;
};

export type Milestone = { streak: number; workoutId: string; at: string };

type Data = {
  /** Profile row id in Postgres; created once, kept across syncs. */
  profileId: string;
  saved: boolean;
  email?: string;
  lastSyncAt?: string;
  /** "Not now" on the save-progress screen. */
  promptDismissed: boolean;
  /** Code from a referral link, redeemed when the account is saved. */
  pendingReferral?: string;
  referralRedeemed: boolean;
  /** The server answered the reward claim (granted, or nothing to grant). */
  referralRewardDone: boolean;
  referralCode?: string;
  notifications: NotificationPrefs;
  /** Last streak milestone not yet celebrated. */
  milestone: Milestone | null;
};

type Actions = {
  update: (patch: Partial<Data>) => void;
  setNotifications: (patch: Partial<NotificationPrefs>) => void;
  reset: () => void;
};

const initial = (): Data => ({
  profileId: uuid(),
  saved: false,
  promptDismissed: false,
  referralRedeemed: false,
  referralRewardDone: false,
  notifications: {
    reminders: false,
    reminderTime: '18:30',
    streakSaver: false,
    streakSaverTime: '20:00',
  },
  milestone: null,
});

export const useAccountStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...initial(),
      update: (patch) => set(patch),
      setNotifications: (patch) => set({ notifications: { ...get().notifications, ...patch } }),
      reset: () =>
        set({
          ...initial(),
          email: undefined,
          lastSyncAt: undefined,
          pendingReferral: undefined,
          referralCode: undefined,
        }),
    }),
    {
      name: 'account',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) =>
        Object.fromEntries(
          Object.entries(s).filter(([, value]) => typeof value !== 'function'),
        ) as Data,
    },
  ),
);

/** Referral codes: 6–10 unambiguous capitals and digits (matches Postgres). */
export function normalizeReferral(raw: string | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  return /^[A-Z2-9]{6,10}$/.test(code) ? code : null;
}
