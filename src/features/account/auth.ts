import type { SupabaseClient } from '@supabase/supabase-js';

import { captchaEnabled, requestCaptchaToken, withCaptcha } from '@/features/captcha/captcha';
import { ensureSession } from '@/lib/supabase';

import { countWrong, lockMinutesLeft, markSent, pullLock, sendWaitSeconds } from './codeLimits';
import { useAccountStore } from './store';

/**
 * Save progress with an email code (SPEC §8: Apple / Google / email).
 *
 * The coach already runs on an anonymous Supabase user. Saving progress
 * upgrades that same user by adding an email, so nothing is lost. If the
 * email already has an account, we sign in to it instead and the phone's
 * data is copied there on the next sync.
 */
export type EmailMode = 'upgrade' | 'signin';
export type SendResult =
  | { status: 'sent'; mode: EmailMode }
  | { status: 'invalid' | 'offline' | 'rate_limited' | 'error' }
  /** One code a minute (security round 1, S2-07). */
  | { status: 'wait'; seconds: number };
export type VerifyResult = 'ok' | 'wrong_code' | 'error' | 'locked';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (value: string) => EMAIL.test(value.trim());

type AuthError = { code?: string; status?: number } | null;

const failure = (error: AuthError): SendResult =>
  error?.status === 429 || error?.code === 'over_email_send_rate_limit'
    ? { status: 'rate_limited' }
    : { status: 'error' };

export async function sendEmailCode(
  supabase: SupabaseClient | null,
  rawEmail: string,
): Promise<SendResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!isEmail(email)) return { status: 'invalid' };
  if (!supabase) return { status: 'offline' };
  const seconds = sendWaitSeconds();
  if (seconds > 0) return { status: 'wait', seconds };
  try {
    // "Sign in again" (QA R10 P2): straight to the account's code, never
    // through a new anonymous user.
    if (!useAccountStore.getState().needsSignIn) {
      if (!(await ensureSession(supabase))) return { status: 'offline' };
      const { error } = await supabase.auth.updateUser({ email });
      if (!error) {
        markSent(email);
        return { status: 'sent', mode: 'upgrade' };
      }
      if ((error as AuthError)?.code !== 'email_exists') return failure(error as AuthError);
    }
    const captchaToken = await requestCaptchaToken();
    if (captchaEnabled() && !captchaToken) return { status: 'error' };
    const signIn = await supabase.auth.signInWithOtp({
      email,
      options: withCaptcha({ shouldCreateUser: false }, captchaToken),
    });
    if (signIn.error) return failure(signIn.error as AuthError);
    markSent(email);
    return { status: 'sent', mode: 'signin' };
  } catch {
    return { status: 'offline' };
  }
}

export async function verifyEmailCode(
  supabase: SupabaseClient | null,
  rawEmail: string,
  code: string,
  mode: EmailMode,
): Promise<VerifyResult> {
  if (!supabase) return 'error';
  const email = rawEmail.trim().toLowerCase();
  // 5 wrong codes lock this email for 15 minutes (security round 1, S2-07).
  await pullLock(supabase, email);
  if (lockMinutesLeft(email) > 0) return 'locked';
  const wrong = async (): Promise<VerifyResult> =>
    (await countWrong(supabase, email)) === 'locked' ? 'locked' : 'wrong_code';
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return wrong();
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: mode === 'upgrade' ? 'email_change' : 'email',
    });
    if (!error) return 'ok';
    const e = error as AuthError;
    return e?.code === 'otp_expired' || e?.status === 403 ? wrong() : 'error';
  } catch {
    return 'error';
  }
}

/** Signs out; the phone keeps its data and a new anonymous user starts later. */
export async function signOut(supabase: SupabaseClient | null): Promise<void> {
  await supabase?.auth.signOut();
}
