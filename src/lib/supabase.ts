import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from './env';

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase client, or null when the app runs without backend config
 * (onboarding is local-first, SPEC §12 Phase 1).
 *
 * Sessions are not persisted yet: accounts arrive in Phase 5, together with an
 * MMKV-backed auth storage adapter.
 */
export function getSupabase(): SupabaseClient | null {
  if (!publicEnv) return null;
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
