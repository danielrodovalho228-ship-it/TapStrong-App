import type { SupabaseClient } from '@supabase/supabase-js';

import { useAccountStore } from '../account/store';

import { useParentPinStore, type PinCheck } from './parentPin';

/**
 * Server mirror of the parent PIN lockout (QA round 3): when online, wrong
 * tries are also counted on the account, and a lock found there is applied
 * on the phone, so clearing app storage doesn't reset the 5-try limit.
 * Offline the phone's own (Keychain) lockout still holds.
 */
const signedIn = () => useAccountStore.getState().saved;

/** Takes the later of the phone's and the server's lock end. */
export function mergeLock(serverUntil: string | null) {
  if (!serverUntil) return;
  const local = useParentPinStore.getState().lockedUntil;
  if (!local || Date.parse(serverUntil) > Date.parse(local))
    useParentPinStore.setState({ lockedUntil: serverUntil, failures: 0 });
}

export async function pullPinLock(supabase: SupabaseClient | null): Promise<void> {
  if (!supabase || !signedIn()) return;
  try {
    const { data, error } = await supabase.rpc('parent_pin_locked_until');
    if (!error) mergeLock((data as string | null) ?? null);
  } catch {
    // Offline: the phone's lockout still applies.
  }
}

export async function reportPinCheck(
  supabase: SupabaseClient | null,
  result: PinCheck,
): Promise<void> {
  if (!supabase || !signedIn() || (result !== 'ok' && result !== 'wrong' && result !== 'locked'))
    return;
  try {
    if (result === 'ok') {
      await supabase.rpc('parent_pin_passed');
      return;
    }
    const { data, error } = await supabase.rpc('parent_pin_failed');
    if (!error) mergeLock((data as string | null) ?? null);
  } catch {
    // Offline: counted on the phone only.
  }
}

/** A new PIN after the email reset clears the server count too. */
export async function clearPinLock(supabase: SupabaseClient | null): Promise<void> {
  if (!supabase || !signedIn()) return;
  try {
    await supabase.rpc('parent_pin_passed');
  } catch {
    // Offline: nothing to clear yet.
  }
}
