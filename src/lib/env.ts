/**
 * Public, bundle-safe configuration. Only EXPO_PUBLIC_* values may appear here.
 * Secrets (Claude API key, service role key) live in Supabase secrets, never in the app.
 */

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type RawEnv = Record<string, string | undefined>;

export function readPublicEnv(raw: RawEnv): PublicEnv | null {
  const supabaseUrl = raw.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = raw.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!/^https?:\/\//.test(supabaseUrl)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must start with http(s)://');
  }
  return { supabaseUrl, supabaseAnonKey };
}

// Expo inlines EXPO_PUBLIC_* only when accessed as literal `process.env.NAME`.
export const publicEnv = readPublicEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
