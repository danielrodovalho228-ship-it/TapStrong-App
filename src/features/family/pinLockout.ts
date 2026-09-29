import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { reportServerMissing } from '@/lib/monitoring';
import { isNetworkError } from '@/lib/network';

import { useAccountStore } from '../account/store';

import { useOwnerIdentityStore } from './ownerIdentity';
import {
  checkParentPin,
  MAX_OFFLINE_WRONG,
  setParentPin,
  useParentPinStore,
  type PinCheck,
} from './parentPin';

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
export type PinSave = 'ok' | 'reauth' | 'offline' | 'invalid' | 'wrong' | 'locked';

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
    await flushPendingPin(supabase);
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
/**
 * A PIN kept on this phone while it had no session (first PIN offline, or a
 * reset whose session didn't come back) goes to the server once signed in.
 * If the server wants proof, a fresh email-code sign-in (the Account's "sign
 * in again") opens its window (security round 2, S2-P2-3).
 */
async function flushPendingPin(supabase: SupabaseClient) {
  const pending = useParentPinStore.getState().pendingPin;
  if (!pending) return;
  const set = async () => (await supabase.rpc('set_parent_pin', { new_pin: pending })).data;
  let result = await set();
  if (result === 'reauth' && (await openPinResetWindow(supabase))) result = await set();
  if (result === 'ok') {
    useParentPinStore.setState({ pendingPin: null, serverHasPin: true, pinVersion: null });
    return;
  }
  // No proof to give: the account keeps its PIN; this phone's copy is dropped
  // so the offline fallback never disagrees with the server.
  if (result === 'reauth' || result === 'invalid')
    useParentPinStore.setState({ pendingPin: null, hash: null, salt: null, pinVersion: null });
}

/** Kept for older callers: the status includes the lock. */
export const pullPinLock = pullPinStatus;

/**
 * The phone's copy (native only). With an account, offline wrong tries count
 * on a counter that never goes down offline: after MAX_OFFLINE_WRONG the
 * phone needs the server again (security round 2, P3).
 */
const localCheck = (pin: string): GateCheck => {
  if (!native()) return 'offline';
  const account = signedIn();
  if (account && useParentPinStore.getState().offlineWrong >= MAX_OFFLINE_WRONG) return 'offline';
  const result = checkParentPin(pin);
  if (account && (result === 'wrong' || result === 'locked'))
    useParentPinStore.setState((s) => ({ offlineWrong: s.offlineWrong + 1 }));
  return result;
};

/**
 * The parent gate's check. Server first with a saved account; the phone's
 * copy only offline (native), without an account, or for a PIN set before
 * the server kept one (then sent up once).
 */
export async function verifyPin(supabase: SupabaseClient | null, pin: string): Promise<GateCheck> {
  if (!supabase || !signedIn()) return localCheck(pin);
  let row:
    | {
        result?: string;
        failures?: number;
        locked_until?: string | null;
        pin_version?: string | null;
      }
    | undefined;
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
  // The phone's offline copy must follow the account's PIN (round 2,
  // S2-P2-3): made again when the server's version changed (the slow key
  // derivation runs once per version), dropped when it is stale.
  const version = row?.pin_version ?? null;
  const stale = () => useParentPinStore.getState().pinVersion !== version;
  switch (row?.result) {
    case 'ok':
      if (!useParentPinStore.getState().hash || stale()) setParentPin(pin);
      useParentPinStore.setState({
        serverHasPin: true,
        failures: 0,
        lockedUntil: null,
        pinVersion: version,
        offlineWrong: 0,
      });
      return 'ok';
    case 'wrong':
      if (stale()) useParentPinStore.setState({ hash: null, salt: null, pinVersion: null });
      useParentPinStore.setState({ failures: row.failures ?? 0, lockedUntil: null });
      return 'wrong';
    case 'locked':
      if (stale()) useParentPinStore.setState({ hash: null, salt: null, pinVersion: null });
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
 * Saves a new PIN (security round 2, S2-P2-2): changing the account's PIN
 * needs the current one (`oldPin`) or the window a fresh email code opens;
 * a first PIN needs neither while the account manages no minors.
 * Without a session (a reset whose session didn't come back, or offline
 * before any server PIN) the PIN is kept on the phone and sent once signed
 * in (S2-P2-3); changing an existing account PIN offline is refused so the
 * phone and the server never disagree.
 */
export async function savePin(
  supabase: SupabaseClient | null,
  pin: string,
  oldPin?: string,
): Promise<PinSave> {
  const keepForLater = (): PinSave => {
    if (!native()) return 'offline';
    if (!setParentPin(pin)) return 'invalid';
    // Only the owner's own account can take it later.
    if (useOwnerIdentityStore.getState().ownerAuth)
      useParentPinStore.setState({ pendingPin: pin, pinVersion: null });
    return 'ok';
  };
  if (!supabase || !signedIn()) return keepForLater();
  const offline = (): PinSave =>
    useParentPinStore.getState().serverHasPin && !useParentPinStore.getState().pendingPin
      ? 'offline'
      : keepForLater();
  try {
    const { data, error } = await supabase.rpc('set_parent_pin', {
      new_pin: pin,
      ...(oldPin ? { old_pin: oldPin } : {}),
    });
    if (error) {
      if (missing(error as RpcError)) {
        reportServerMissing('set_parent_pin');
        return native() && setParentPin(pin) ? 'ok' : 'offline';
      }
      return offline();
    }
    if (data === 'ok') {
      setParentPin(pin);
      useParentPinStore.setState({ serverHasPin: true, pendingPin: null, pinVersion: null });
      return 'ok';
    }
    if (data === 'invalid' || data === 'wrong' || data === 'locked') return data;
    return 'reauth';
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
