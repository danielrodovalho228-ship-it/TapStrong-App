import { readPublicEnv } from './env';

describe('readPublicEnv', () => {
  it('returns null when Supabase is not configured', () => {
    expect(readPublicEnv({})).toBeNull();
    expect(readPublicEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
  });

  it('reads and trims values', () => {
    expect(
      readPublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: ' https://x.supabase.co ',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: ' anon ',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' });
  });

  it('rejects a URL without scheme', () => {
    expect(() =>
      readPublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'x.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toThrow();
  });
});
