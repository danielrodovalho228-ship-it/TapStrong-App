import type { SupabaseClient } from '@supabase/supabase-js';

import { clock } from '@/lib/clock';
import { isNetworkError } from '@/lib/network';

import { useAccountStore } from '../account/store';

import { useOwnerIdentityStore, type OwnerAuth } from './ownerIdentity';
import { countWrongTry, lockMinutesLeft } from './parentPin';

/**
 * Forgotten parent PIN (Phase 12, Daniel): the account owner signs in again
 * with a code sent to the account's email, then sets a new PIN. The code comes
 * from Supabase Auth, so real users receive it once the Resend SMTP is set up
 * (docs/store/smtp-resend.md); until then it reaches the project team only.
 * A Family plan (the only way to have a teen on the phone) needs a saved
 * account, so there is always an email to send to. The code goes only to the
 * owner's email in the secure record, and only the owner's user passes.
 */
export type ResetSend = 'sent' | 'no_account' | 'offline' | 'rate_limited' | 'wait' | 'error';
export type ResetVerify = 'ok' | 'wrong_code' | 'locked' | 'offline' | 'error' | 'sign_in_again';

type AuthError = { code?: string; status?: number } | null;

/** "d•••@example.com": enough for the owner to recognise, not to read out. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}•••@${domain}`;
}

/**
 * The owner's sign-in, from the secure owner record (QA R8-05). The plain
 * account email can be edited on the phone, so it never decides where a code
 * goes. A phone saved before the record existed learns it once from the
 * signed-in Supabase user (verified by the server, not read from storage).
 */
export const ownerAuth = (): OwnerAuth | null => useOwnerIdentityStore.getState().ownerAuth;
export const ownerEmail = () => ownerAuth()?.email ?? null;

/** Called when the owner saves the account (account screen, owner-only). */
export async function rememberOwnerAuth(supabase: SupabaseClient | null, email: string) {
  try {
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    const userId = data.user?.id;
    if (userId) useOwnerIdentityStore.getState().setOwnerAuth({ email, userId });
  } catch {
    // Offline: learnt later from the signed-in account (resolveOwnerAuth).
  }
}

export async function resolveOwnerAuth(supabase: SupabaseClient | null): Promise<OwnerAuth | null> {
  const known = ownerAuth();
  if (known || !supabase || !useAccountStore.getState().saved) return known;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.id || !user.email || user.is_anonymous) return null;
    const auth = { email: user.email.toLowerCase(), userId: user.id };
    useOwnerIdentityStore.getState().setOwnerAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

/** One code a minute at most (QA R9 P2: 20 taps sent 20 emails). */
export const CODE_COOLDOWN_MS = 60_000;
let lastCodeAt = 0;
/** Tests only. */
export const resetCodeCooldown = () => {
  lastCodeAt = 0;
};

export async function sendPinResetCode(supabase: SupabaseClient | null): Promise<ResetSend> {
  if (!supabase) return ownerAuth() ? 'offline' : 'no_account';
  if (clock.now().getTime() - lastCodeAt < CODE_COOLDOWN_MS) return 'wait';
  const auth = await resolveOwnerAuth(supabase);
  if (!auth) return 'no_account';
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: auth.email,
      options: { shouldCreateUser: false },
    });
    if (!error) {
      lastCodeAt = clock.now().getTime();
      return 'sent';
    }
    if (isNetworkError(error)) return 'offline';
    const e = error as AuthError;
    return e?.status === 429 || e?.code === 'over_email_send_rate_limit' ? 'rate_limited' : 'error';
  } catch {
    return 'offline';
  }
}

async function currentSession(supabase: SupabaseClient) {
  try {
    return (await supabase.auth.getSession()).data.session;
  } catch {
    return null;
  }
}

type Session = Awaited<ReturnType<typeof currentSession>>;
type AuthCall = Promise<{ error: unknown }>;

/** true only when the call returned without an error and didn't throw. */
async function succeeded(call: () => AuthCall): Promise<boolean> {
  try {
    const { error } = await call();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Ends the code's session and puts back the phone's own (QA R8-05, R9-05):
 * - sign-out failed (twice): the owner's code session could stay open on
 *   this phone → "signout_failed", never success;
 * - the previous session can't come back (expired, offline) or there was
 *   none: the phone is signed out → "restore_failed". The account is marked
 *   "sign in again" so no background sync starts a new anonymous account.
 */
async function endCodeSession(
  supabase: SupabaseClient,
  before: Session,
): Promise<'ok' | 'signout_failed' | 'restore_failed'> {
  const signOut = () => supabase.auth.signOut({ scope: 'local' }) as AuthCall;
  if (!(await succeeded(signOut)) && !(await succeeded(signOut))) return 'signout_failed';
  const restored =
    !!before &&
    (await succeeded(
      () =>
        supabase.auth.setSession({
          access_token: before.access_token,
          refresh_token: before.refresh_token,
        }) as AuthCall,
    ));
  if (restored) return 'ok';
  useAccountStore.getState().update({ saved: false, needsSignIn: true });
  return 'restore_failed';
}

/**
 * Checks the code, and that it signed in the owner's own user. Either way the
 * code's session is signed out and the phone goes back to the session it had.
 */
export async function verifyPinResetCode(
  supabase: SupabaseClient | null,
  code: string,
): Promise<ResetVerify> {
  const auth = ownerAuth();
  if (!auth) return 'error';
  if (!supabase) return 'offline';
  // Wrong codes share the parent PIN's lockout: 5 in a row lock 15 minutes.
  if (lockMinutesLeft() > 0) return 'locked';
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return countWrongTry() === 'locked' ? 'locked' : 'wrong_code';
  try {
    const before = await currentSession(supabase);
    const { data, error } = await supabase.auth.verifyOtp({
      email: auth.email,
      token,
      type: 'email',
    });
    if (!error) {
      // The code's own session is only proof: it is always signed out and
      // the phone goes back to the session it had (QA R8-05, Phase 21).
      const ended = await endCodeSession(supabase, before);
      if (ended === 'signout_failed') return 'error';
      if (ended === 'restore_failed') return 'sign_in_again';
      return data?.user?.id === auth.userId ? 'ok' : 'error';
    }
    if (isNetworkError(error)) return 'offline';
    const e = error as AuthError;
    if (e?.code === 'otp_expired' || e?.status === 403)
      return countWrongTry() === 'locked' ? 'locked' : 'wrong_code';
    return 'error';
  } catch {
    return 'offline';
  }
}
