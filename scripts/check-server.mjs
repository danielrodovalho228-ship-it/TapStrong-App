// Phase 23 answer 3 / security round 1: the app needs tables and functions
// from migrations Daniel pushes himself (`supabase db push`). This asks the
// server's API, with the public anon key only, whether each function exists:
// a missing one answers PGRST202 ("could not find the function"); an existing
// one the anon key may not run answers 401/403 — that's fine.
//   npm run server:check        (needs EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)
// env:check runs it for production builds, so a build never ships against a
// server without its migrations. docs/launch-readiness.md lists them.
export const EXPECTED = [
  ['20261017000000_pin_reset_code_lockout', 'pin_reset_code_locked_until', {}],
  ['20261018000000_security_s1_profile_owner', 'my_referral_stats', {}],
  ['20261018000100_security_s1_server_pin', 'verify_parent_pin', { pin: '0000' }],
  ['20261018000100_security_s1_server_pin', 'parent_pin_status', {}],
  ['20261018000200_security_s2_profiles', 'profile_age', { birth_year: 2000, birth_month: 1 }],
  [
    '20261018000400_security_s2_account_code',
    'account_code_locked_until',
    { email: 'probe@example.com' },
  ],
];

export async function missingOnServer(url, anonKey, fetchImpl = fetch) {
  const missing = [];
  for (const [migration, fn, args] of EXPECTED) {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    let code = '';
    try {
      code = (await res.json())?.code ?? '';
    } catch {
      // Not JSON.
    }
    if (code === 'PGRST202' || (res.status === 404 && code !== '42501'))
      missing.push([migration, fn]);
  }
  return missing;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    console.error('server:check needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  const missing = await missingOnServer(url, key);
  if (missing.length) {
    console.error('The Supabase server is missing migrations this app needs:');
    for (const [m, fn] of missing) console.error(`  ${m}  (function ${fn})`);
    console.error('Run `supabase db push` (docs/launch-readiness.md, "Migrações pendentes").');
    process.exit(1);
  }
  console.log(`OK: the server has the ${EXPECTED.length} functions from the latest migrations`);
}
