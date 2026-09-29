import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { useAccountStore } from '@/features/account/store';
import {
  captchaEnabled,
  captchaFailedThisSession,
  requestCaptchaToken,
} from '@/features/captcha/captcha';

import { publicEnv } from './env';
import { kvStorage } from './storage';

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase client, or null when the app runs without backend
 * config (onboarding is local-first, SPEC §12 Phase 1).
 */
export function getSupabase(): SupabaseClient | null {
  if (!publicEnv) return null;
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: {
        storage: kvStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Makes sure there is a session before calling the coach. Without an account
 * we sign in anonymously, so coach calls can be limited per user. Accounts
 * (Phase 5) upgrade this anonymous user instead of creating a new one.
 * A phone that lost the account's session (PIN reset) waits for the owner to
 * sign in again: no anonymous user is created meanwhile (QA R10 P2).
 */
export async function ensureSession(
  supabase: SupabaseClient,
  opts: { skipCaptchaAfterFailure?: boolean } = {},
): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  if (useAccountStore.getState().needsSignIn) return false;
  // The coach doesn't ask again after a failed or closed check (S2-P2-8).
  if (opts.skipCaptchaAfterFailure && captchaEnabled() && captchaFailedThisSession()) return false;
  // A person check before each new anonymous account (security round 1, S2-04).
  const captchaToken = await requestCaptchaToken();
  if (captchaEnabled() && !captchaToken) return false;
  const { error } = await supabase.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  );
  return !error;
}
