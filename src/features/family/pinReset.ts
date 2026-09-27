import type { SupabaseClient } from '@supabase/supabase-js';

import { useAccountStore } from '../account/store';

/**
 * Forgotten parent PIN (Phase 12, Daniel): the account owner signs in again
 * with a code sent to the account's email, then sets a new PIN. The code comes
 * from Supabase Auth, so real users receive it once the Resend SMTP is set up
 * (docs/store/smtp-resend.md); until then it reaches the project team only.
 * A Family plan (the only way to have a teen on the phone) needs a saved
 * account, so there is always an email to send to.
 */
export type ResetSend = 'sent' | 'no_account' | 'offline' | 'rate_limited' | 'error';
export type ResetVerify = 'ok' | 'wrong_code' | 'offline' | 'error';

type AuthError = { code?: string; status?: number } | null;

/** "d•••@gmail.com": enough for the owner to recognise, not to read out. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}•••@${domain}`;
}

export const ownerEmail = () => {
  const { saved, email } = useAccountStore.getState();
  return saved && email ? email : null;
};

export async function sendPinResetCode(supabase: SupabaseClient | null): Promise<ResetSend> {
  const email = ownerEmail();
  if (!email) return 'no_account';
  if (!supabase) return 'offline';
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (!error) return 'sent';
    const e = error as AuthError;
    return e?.status === 429 || e?.code === 'over_email_send_rate_limit' ? 'rate_limited' : 'error';
  } catch {
    return 'offline';
  }
}

export async function verifyPinResetCode(
  supabase: SupabaseClient | null,
  code: string,
): Promise<ResetVerify> {
  const email = ownerEmail();
  if (!email) return 'error';
  if (!supabase) return 'offline';
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return 'wrong_code';
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (!error) return 'ok';
    const e = error as AuthError;
    return e?.code === 'otp_expired' || e?.status === 403 ? 'wrong_code' : 'error';
  } catch {
    return 'offline';
  }
}
