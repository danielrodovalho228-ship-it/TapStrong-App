import type { SupabaseClient } from '@supabase/supabase-js';

import { isNetworkError } from '@/lib/network';

import { useAccountStore } from '../account/store';

import { useOwnerIdentityStore, type OwnerAuth } from './ownerIdentity';
import {
  clearCodeLock,
  codeLockMinutesLeft,
  codeWaitSeconds,
  countWrongCode,
  markCodeSent,
  pullCodeLock,
  reportCodeCheck,
  useResetCodeStore,
} from './resetCodeLock';

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
/** "ok_signed_out": the owner's code passed, but the phone lost its session (QA R10-03). */
export type ResetVerify = 'ok' | 'ok_signed_out' | 'wrong_code' | 'locked' | 'offline' | 'error';

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

export { CODE_COOLDOWN_MS } from './resetCodeLock';
/** Tests only. */
export const resetCodeCooldown = () => useResetCodeStore.getState().reset();

export async function sendPinResetCode(supabase: SupabaseClient | null): Promise<ResetSend> {
  if (!supabase) return ownerAuth() ? 'offline' : 'no_account';
  // One code a minute at most (QA R9 P2), kept in the secure store (R10).
  if (codeWaitSeconds() > 0) return 'wait';
  const auth = await resolveOwnerAuth(supabase);
  if (!auth) return 'no_account';
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: auth.email,
      options: { shouldCreateUser: false },
    });
    if (!error) {
      markCodeSent();
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
 * Ends the code's session and puts back the phone's own (QA R8-05, R9-05,
 * R10 P2). supabase-js removes the local session even when the sign-out call
 * fails, so the previous session is always put back:
 * - restored: "ok";
 * - not restored and the sign-out failed: the code's session may still be on
 *   the phone → "signout_failed";
 * - not restored (expired, offline): the phone is signed out →
 *   "restore_failed". The account is marked "sign in again" so no background
 *   sync starts a new anonymous account.
 */
async function endCodeSession(
  supabase: SupabaseClient,
  before: NonNullable<Session>,
): Promise<'ok' | 'signout_failed' | 'restore_failed'> {
  const signOut = () => supabase.auth.signOut({ scope: 'local' }) as AuthCall;
  const signedOut = (await succeeded(signOut)) || (await succeeded(signOut));
  const restored = await succeeded(
    () =>
      supabase.auth.setSession({
        access_token: before.access_token,
        refresh_token: before.refresh_token,
      }) as AuthCall,
  );
  if (restored) return 'ok';
  useAccountStore.getState().update({ saved: false, needsSignIn: true });
  return signedOut ? 'restore_failed' : 'signout_failed';
}

/**
 * Checks the code, and that it signed in the owner's own user.
 * - Another user: its session is ended, the phone's own put back → "error".
 * - The owner, and the phone had a session: the code's session is only proof,
 *   so it is ended and the previous one put back. If that fails the owner
 *   still sets the new PIN ("ok_signed_out") and signs in again from Account:
 *   a failed restore must never lock the owner out (QA R10-03).
 * - The owner, and the phone had no session (signed out by an earlier
 *   reset): the verified owner session is kept, so the account is back.
 */
export async function verifyPinResetCode(
  supabase: SupabaseClient | null,
  code: string,
): Promise<ResetVerify> {
  const auth = ownerAuth();
  if (!auth) return 'error';
  if (!supabase) return 'offline';
  // Wrong codes have their own lockout, apart from the PIN's (R10 decision 1).
  await pullCodeLock(supabase);
  if (codeLockMinutesLeft() > 0) return 'locked';
  const wrong = async (): Promise<ResetVerify> => {
    const result = countWrongCode();
    await reportCodeCheck(supabase, result);
    return result === 'locked' ? 'locked' : 'wrong_code';
  };
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return wrong();
  try {
    const before = await currentSession(supabase);
    const { data, error } = await supabase.auth.verifyOtp({
      email: auth.email,
      token,
      type: 'email',
    });
    if (!error) {
      const owner = data?.user?.id === auth.userId;
      if (!before) {
        if (!owner) {
          await succeeded(() => supabase.auth.signOut({ scope: 'local' }) as AuthCall);
          return 'error';
        }
        useAccountStore.getState().update({ saved: true, needsSignIn: false, email: auth.email });
      } else {
        const ended = await endCodeSession(supabase, before);
        if (!owner) return 'error';
        if (ended !== 'ok') {
          clearCodeLock();
          return 'ok_signed_out';
        }
      }
      clearCodeLock();
      await reportCodeCheck(supabase, 'ok');
      return 'ok';
    }
    if (isNetworkError(error)) return 'offline';
    const e = error as AuthError;
    if (e?.code === 'otp_expired' || e?.status === 403) return wrong();
    return 'error';
  } catch {
    return 'offline';
  }
}
