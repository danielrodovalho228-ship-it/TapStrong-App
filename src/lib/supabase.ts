import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
 */
export async function ensureSession(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const { error } = await supabase.auth.signInAnonymously();
  return !error;
}
