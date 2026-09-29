import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { secureStorage } from '@/lib/secureStorage';

/**
 * Limits on the Account email code (security round 1, S2-07): one code a
 * minute, and 5 wrong codes for an email lock it for 15 minutes. Kept in the
 * Keychain / Keystore and, while the phone has a session, counted on the
 * server (account_code_failed) so clearing the app doesn't lift the lock.
 */
export const SEND_COOLDOWN_MS = 60_000;
export const MAX_WRONG = 5;
export const LOCK_MINUTES = 15;

type State = {
  lastSentAt: string | null;
  email: string | null;
  failures: number;
  lockedUntil: string | null;
  reset: () => void;
};
const EMPTY = { lastSentAt: null, email: null, failures: 0, lockedUntil: null };

export const useAccountCodeStore = create<State>()(
  persist((set) => ({ ...EMPTY, reset: () => set({ ...EMPTY }) }), {
    name: 'account-code-secure',
    version: 1,
    storage: createJSONStorage(() => secureStorage),
    partialize: ({ lastSentAt, email, failures, lockedUntil }) => ({
      lastSentAt,
      email,
      failures,
      lockedUntil,
    }),
  }),
);

const norm = (email: string) => email.trim().toLowerCase();

/** Seconds before another code may be sent; a clock set back waits the full minute. */
export function sendWaitSeconds(now: Date = clock.now()): number {
  const last = useAccountCodeStore.getState().lastSentAt;
  if (!last) return 0;
  const since = now.getTime() - Date.parse(last);
  if (since < 0) return SEND_COOLDOWN_MS / 1000;
  return Math.max(0, Math.ceil((SEND_COOLDOWN_MS - since) / 1000));
}

export function markSent(email: string, now: Date = clock.now()) {
  const s = useAccountCodeStore.getState();
  useAccountCodeStore.setState({
    lastSentAt: now.toISOString(),
    // A different email starts its own count.
    ...(s.email !== norm(email) ? { email: norm(email), failures: 0, lockedUntil: null } : {}),
  });
}

export function lockMinutesLeft(email: string, now: Date = clock.now()): number {
  const s = useAccountCodeStore.getState();
  if (s.email !== norm(email) || !s.lockedUntil) return 0;
  return Math.max(0, Math.ceil((Date.parse(s.lockedUntil) - now.getTime()) / 60000));
}

function mergeLock(email: string, until: string | null) {
  if (!until) return;
  const s = useAccountCodeStore.getState();
  const local = s.email === norm(email) ? s.lockedUntil : null;
  if (!local || Date.parse(until) > Date.parse(local))
    useAccountCodeStore.setState({ email: norm(email), lockedUntil: until, failures: 0 });
}

/** One wrong code; also counted on the server while there is a session. */
export async function countWrong(
  supabase: SupabaseClient | null,
  email: string,
  now: Date = clock.now(),
): Promise<'wrong' | 'locked'> {
  const s = useAccountCodeStore.getState();
  const same = s.email === norm(email);
  const failures = (same && !s.lockedUntil ? s.failures : 0) + 1;
  if (failures >= MAX_WRONG)
    useAccountCodeStore.setState({
      email: norm(email),
      failures: 0,
      lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString(),
    });
  else useAccountCodeStore.setState({ email: norm(email), failures, lockedUntil: null });
  try {
    const { data, error } = (await supabase?.rpc('account_code_failed', {
      email: norm(email),
    })) ?? {
      data: null,
      error: null,
    };
    if (!error) mergeLock(email, (data as string | null) ?? null);
  } catch {
    // Offline or signed out: counted on the phone.
  }
  return lockMinutesLeft(email, now) > 0 ? 'locked' : 'wrong';
}

/** A lock kept on the server (another install on this account) applies here. */
export async function pullLock(supabase: SupabaseClient | null, email: string): Promise<void> {
  try {
    const { data, error } = (await supabase?.rpc('account_code_locked_until', {
      email: norm(email),
    })) ?? { data: null, error: null };
    if (!error) mergeLock(email, (data as string | null) ?? null);
  } catch {
    // Offline: the phone's lock still applies.
  }
}
