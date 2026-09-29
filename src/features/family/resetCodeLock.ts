import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { secureStorage } from '@/lib/secureStorage';

import { useAccountStore } from '../account/store';

import { LOCK_MINUTES, MAX_TRIES } from './parentPin';

/**
 * Limits on the PIN-reset email code (QA R9 P2, R10 decision 1): its own
 * counter, apart from the parent PIN's, so a teen typing wrong PINs never
 * blocks the owner's reset. 5 wrong codes lock the code for 15 minutes, and
 * one code can be sent a minute. Kept in the Keychain / Keystore so killing
 * the app doesn't lift them, and mirrored on the server when online.
 */
export const CODE_COOLDOWN_MS = 60_000;

type State = {
  failures: number;
  lockedUntil: string | null;
  /** When the last code was sent (ISO). */
  lastCodeAt: string | null;
  reset: () => void;
};

const EMPTY = { failures: 0, lockedUntil: null, lastCodeAt: null };

export const useResetCodeStore = create<State>()(
  persist(
    (set) => ({
      ...EMPTY,
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'pin-reset-code-secure',
      version: 1,
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ failures, lockedUntil, lastCodeAt }) => ({
        failures,
        lockedUntil,
        lastCodeAt,
      }),
    },
  ),
);

/** Minutes left on the code lockout, or 0. */
export function codeLockMinutesLeft(now: Date = clock.now()): number {
  const until = useResetCodeStore.getState().lockedUntil;
  if (!until) return 0;
  return Math.max(0, Math.ceil((Date.parse(until) - now.getTime()) / 60000));
}

/**
 * Seconds before another code may be sent, or 0. A clock set back before the
 * last send counts as a full wait (QA R10 P2).
 */
export function codeWaitSeconds(now: Date = clock.now()): number {
  const last = useResetCodeStore.getState().lastCodeAt;
  if (!last) return 0;
  const since = now.getTime() - Date.parse(last);
  if (since < 0) return CODE_COOLDOWN_MS / 1000;
  return Math.max(0, Math.ceil((CODE_COOLDOWN_MS - since) / 1000));
}

export function markCodeSent(now: Date = clock.now()) {
  useResetCodeStore.setState({ lastCodeAt: now.toISOString() });
}

/** One wrong code: the 5th in a row locks the code (not the PIN) for 15 minutes. */
export function countWrongCode(now: Date = clock.now()): 'wrong' | 'locked' {
  const s = useResetCodeStore.getState();
  const failures = (s.lockedUntil ? 0 : s.failures) + 1;
  if (failures >= MAX_TRIES) {
    useResetCodeStore.setState({
      failures: 0,
      lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString(),
    });
    return 'locked';
  }
  useResetCodeStore.setState({ failures, lockedUntil: null });
  return 'wrong';
}

export function clearCodeLock() {
  useResetCodeStore.setState({ failures: 0, lockedUntil: null });
}

// Server mirror (same idea as pinLockout.ts): clearing app data or moving the
// clock doesn't lift a lock while the phone is online.
const signedIn = () => useAccountStore.getState().saved;

function mergeCodeLock(serverUntil: string | null) {
  if (!serverUntil) return;
  const local = useResetCodeStore.getState().lockedUntil;
  if (!local || Date.parse(serverUntil) > Date.parse(local))
    useResetCodeStore.setState({ lockedUntil: serverUntil, failures: 0 });
}

export async function pullCodeLock(supabase: SupabaseClient | null): Promise<void> {
  if (!supabase || !signedIn()) return;
  try {
    const { data, error } = await supabase.rpc('pin_reset_code_locked_until');
    if (!error) mergeCodeLock((data as string | null) ?? null);
  } catch {
    // Offline: the phone's lockout still applies.
  }
}

export async function reportCodeCheck(
  supabase: SupabaseClient | null,
  result: 'ok' | 'wrong' | 'locked',
): Promise<void> {
  if (!supabase || !signedIn()) return;
  try {
    if (result === 'ok') {
      await supabase.rpc('pin_reset_code_passed');
      return;
    }
    const { data, error } = await supabase.rpc('pin_reset_code_failed');
    if (!error) mergeCodeLock((data as string | null) ?? null);
  } catch {
    // Offline: counted on the phone only.
  }
}
