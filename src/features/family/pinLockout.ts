import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { reportServerMissing } from '@/lib/monitoring';
import { isNetworkError } from '@/lib/network';

import { useAccountStore } from '../account/store';

import { checkParentPin, setParentPin, useParentPinStore, type PinCheck } from './parentPin';

/**
 * The parent PIN on the server (security round 1, S1-03, Daniel's decision).
 *
 * With a saved account the server decides: verify_parent_pin() compares a
 * bcrypt hash no client can read and enforces the lockout (5 wrong → 15 min)
 * inside the check, so clearing or editing the phone's storage changes
 * nothing. The phone's Keychain / Keystore copy is only an offline fallback,
 * on native: the web has no secure storage, so it never checks a PIN on its
 * own (and hides family profiles until then, see familyAvailable()).
 */
const signedIn = () => useAccountStore.getState().saved;
const native = () => Platform.OS !== 'web';

export type GateCheck = PinCheck | 'offline';
export type PinSave = 'ok' | 'reauth' | 'offline' | 'invalid';

type RpcError = { code?: string; message?: string } | null;
/** The function isn't on the server yet (a migration not pushed): logged, then the local copy. */
const missing = (e: RpcError) =>
  e?.code === 'PGRST202' ||
  e?.code === '42883' ||
  /could not find the function/i.test(e?.message ?? '');

/** Takes the later of the phone's and the server's lock end. */
export function mergeLock(serverUntil: string | null) {
  if (!serverUntil) return;
  const local = useParentPinStore.getState().lockedUntil;
  if (!local || Date.parse(serverUntil) > Date.parse(local))
    useParentPinStore.setState({ lockedUntil: serverUntil, failures: 0 });
}

/**
 * Whether the account has a PIN, and its lock. A PIN set offline on this
 * phone is sent now (first PIN only: replacing one needs the right PIN or
 * the email code, checked by the server).
 */
export async function pullPinStatus(supabase: SupabaseClient | null): Promise<void> {
  if (!supabase || !signedIn()) return;
  try {
    const pending = useParentPinStore.getState().pendingPin;
    if (pending) {
      const { data, error } = await supabase.rpc('set_parent_pin', { new_pin: pending });
      if (!error && (data === 'ok' || data === 'reauth' || data === 'invalid'))
        useParentPinStore.setState({
          pendingPin: null,
          ...(data === 'ok' ? { serverHasPin: true } : {}),
        });
    }
    const { data, error } = await supabase.rpc('parent_pin_status');
    if (error) {
      if (missing(error as RpcError)) reportServerMissing('parent_pin_status');
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      { has_pin?: boolean; locked_until?: string | null } | undefined;
    if (!row) return;
    useParentPinStore.setState({ serverHasPin: !!row.has_pin });
    mergeLock(row.locked_until ?? null);
  } catch {
    // Offline: the phone's copy still applies (native).
  }
}
/** Kept for older callers: the status includes the lock. */
export const pullPinLock = pullPinStatus;

/** Offline wrong tries on the phone still count on the account once online. */
export async function reportPinCheck(
  supabase: SupabaseClient | null,
  result: PinCheck,
): Promise<void> {
  if (!supabase || !signedIn() || (result !== 'wrong' && result !== 'locked')) return;
  try {
    const { data, error } = await supabase.rpc('parent_pin_failed');
    if (!error) mergeLock((data as string | null) ?? null);
  } catch {
    // Offline: counted on the phone only.
  }
}

const localCheck = (pin: string): GateCheck => (native() ? checkParentPin(pin) : 'offline');

/**
 * The parent gate's check. Server first with a saved account; the phone's
 * copy only offline (native), without an account, or for a PIN set before
 * the server kept one (then sent up once).
 */
export async function verifyPin(supabase: SupabaseClient | null, pin: string): Promise<GateCheck> {
  if (!supabase || !signedIn()) return localCheck(pin);
  let row: { result?: string; failures?: number; locked_until?: string | null } | undefined;
  try {
    const { data, error } = await supabase.rpc('verify_parent_pin', { pin });
    if (error) {
      if (isNetworkError(error)) return localCheck(pin);
      if (missing(error as RpcError)) reportServerMissing('verify_parent_pin');
      return localCheck(pin);
    }
    row = (Array.isArray(data) ? data[0] : data) as typeof row;
  } catch {
    return localCheck(pin);
  }
  switch (row?.result) {
    case 'ok':
      // A new phone gets its offline copy of the account's PIN (the slow key
      // derivation runs once, not on every check).
      if (!useParentPinStore.getState().hash) setParentPin(pin);
      useParentPinStore.setState({ serverHasPin: true, failures: 0, lockedUntil: null });
      return 'ok';
    case 'wrong':
      useParentPinStore.setState({ failures: row.failures ?? 0, lockedUntil: null });
      return 'wrong';
    case 'locked':
      useParentPinStore.setState({ failures: 0, lockedUntil: row.locked_until ?? null });
      return 'locked';
    case 'no_pin': {
      // A PIN made before the server kept one: checked here, then sent up.
      useParentPinStore.setState({ serverHasPin: false });
      const local = localCheck(pin);
      if (local === 'ok') void savePin(supabase, pin);
      return local;
    }
    default:
      return localCheck(pin);
  }
}

/**
 * Saves a new PIN. The server takes it right after the right PIN or the email
 * code (a short window it opens itself), or as the first PIN of an account
 * without minors; otherwise "reauth". Offline, only a first PIN is kept on
 * the phone (native) and sent later; changing an account's PIN needs a
 * connection so the phone and the server never disagree.
 */
export async function savePin(supabase: SupabaseClient | null, pin: string): Promise<PinSave> {
  if (!supabase || !signedIn()) {
    if (!native()) return 'offline';
    return setParentPin(pin) ? 'ok' : 'invalid';
  }
  const offline = (): PinSave => {
    if (!native() || useParentPinStore.getState().serverHasPin) return 'offline';
    if (!setParentPin(pin)) return 'invalid';
    useParentPinStore.setState({ pendingPin: pin });
    return 'ok';
  };
  try {
    const { data, error } = await supabase.rpc('set_parent_pin', { new_pin: pin });
    if (error) {
      if (missing(error as RpcError)) {
        reportServerMissing('set_parent_pin');
        return native() && setParentPin(pin) ? 'ok' : 'offline';
      }
      return offline();
    }
    if (data === 'ok') {
      setParentPin(pin);
      useParentPinStore.setState({ serverHasPin: true, pendingPin: null });
      return 'ok';
    }
    return data === 'invalid' ? 'invalid' : 'reauth';
  } catch {
    return offline();
  }
}

/**
 * Called while the email code's own session is active (forgotten PIN): the
 * server checks the fresh sign-in and opens the window to set a new PIN.
 */
export async function openPinResetWindow(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('open_pin_reset_window');
    if (error && missing(error as RpcError)) reportServerMissing('open_pin_reset_window');
    return !error && data === true;
  } catch {
    return false;
  }
}
