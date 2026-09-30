// Phase 23 answer 3 / security round 1: the app needs tables and functions
// from migrations Daniel pushes himself (`supabase db push`). This asks the
// server's API, with the public anon key only, whether each function exists:
// a missing one answers PGRST202 ("could not find the function"); an existing
// one the anon key may not run answers 401/403 — that's fine.
//   npm run server:check        (needs EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)
// env:check runs it for production builds, so a build never ships against a
// server without its migrations. docs/launch-readiness.md lists them.
//
// Security round 2 also checks Auth:
//  - S2-P2-6: captcha must be on. A probe asks for an email code without a
//    captcha token (for a fake address, so nothing is sent or created); a
//    server with captcha on refuses it with captcha_failed.
//  - S2-P2-5: the email-code limits live in Supabase Auth (one code a minute,
//    codes valid 15 min, per-IP verify limits). With SUPABASE_ACCESS_TOKEN
//    (a personal access token, only in the terminal, never in .env or git)
//    it reads the project's Auth settings from the Management API and checks
//    them against AUTH_RULES.
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
  ['20261019000100_security_r2_pin_change', 'set_parent_pin', { new_pin: '0000', old_pin: '0000' }],
];

/**
 * Migrations that add no function: a table or column, asked for with an
 * empty read (anon key; RLS answers nothing, a missing one answers an error).
 */
export const EXPECTED_COLUMNS = [
  ['20261019000200_security_r2_birth_date', 'profile_birth_changes', 'id'],
  ['20261019000300_security_r2_p3', 'sessions', 'received_at'],
  ['20261020000000_month_reviews', 'month_reviews', 'id'],
  ['20261021000000_moments', 'moments', 'id'],
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
  for (const [migration, table, column] of EXPECTED_COLUMNS) {
    const res = await fetchImpl(
      `${url.replace(/\/$/, '')}/rest/v1/${table}?select=${column}&limit=0`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    let code = '';
    try {
      code = (await res.json())?.code ?? '';
    } catch {
      // Not JSON.
    }
    // PGRST205 / 42P01: no such table; 42703 / PGRST204: no such column.
    if (['PGRST205', '42P01', '42703', 'PGRST204'].includes(code))
      missing.push([migration, `${table}.${column}`]);
  }
  return missing;
}

/**
 * S2-P2-6: an email-code request without a captcha token must be refused.
 * Returns null when captcha is enforced, else what the server answered.
 */
export async function captchaProblem(url, anonKey, fetchImpl = fetch) {
  const res = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'captcha-probe@example.invalid', create_user: false }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    // Not JSON.
  }
  const text = `${body.error_code ?? body.code ?? ''} ${body.msg ?? body.message ?? ''}`;
  if (body.error_code === 'captcha_failed' || /captcha/i.test(text)) return null;
  return `captcha is off: an email code was requested without a captcha token (HTTP ${res.status} ${text.trim()})`;
}

/** Supabase Auth settings the app relies on (docs/SECURITY.md rule 6). */
export const AUTH_RULES = [
  ['security_captcha_enabled', (v) => v === true, 'captcha on'],
  ['security_captcha_provider', (v) => v === 'turnstile', 'captcha provider turnstile'],
  ['smtp_max_frequency', (v) => v >= 60, 'at most one email a minute (>= 60 s)'],
  ['mailer_otp_exp', (v) => v > 0 && v <= 900, 'email codes expire within 900 s'],
  ['mailer_autoconfirm', (v) => v === false, '"Confirm email" on'],
  ['rate_limit_verify', (v) => v > 0 && v <= 30, 'code checks <= 30 per 5 min per IP'],
  [
    'rate_limit_anonymous_users',
    (v) => v > 0 && v <= 30,
    'anonymous sign-ins <= 30 per hour per IP',
  ],
  ['password_min_length', (v) => v >= 10, 'passwords of 10+ characters'],
];

/** Problems and unknowns in a project's Auth config (Management API shape). */
export function authSettingsProblems(config) {
  const problems = [];
  const unknown = [];
  for (const [key, ok, want] of AUTH_RULES) {
    if (!(key in config)) unknown.push(`${key} (${want})`);
    else if (!ok(config[key]))
      problems.push(`${key} = ${JSON.stringify(config[key])}: want ${want}`);
  }
  return { problems, unknown };
}

/** The project's Auth config, or null without a Management API token. */
export async function fetchAuthConfig(url, token, fetchImpl = fetch) {
  const ref = new URL(url).hostname.split('.')[0];
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Management API answered HTTP ${res.status}`);
  return res.json();
}

/**
 * Everything a production build needs from the server: the migrations,
 * captcha on, and (with a token) the Auth limits. Returns failure lines.
 */
export async function serverProblems(url, anonKey, env = process.env, fetchImpl = fetch) {
  const problems = [];
  const warnings = [];
  for (const [m, fn] of await missingOnServer(url, anonKey, fetchImpl))
    problems.push(`missing migration ${m} (${fn}): run \`supabase db push\``);
  const captcha = await captchaProblem(url, anonKey, fetchImpl);
  if (captcha)
    problems.push(`${captcha} — turn it on in Supabase → Authentication → Attack Protection`);
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    warnings.push(
      'Auth limits not checked: set SUPABASE_ACCESS_TOKEN in the terminal (never in .env) to check them',
    );
  } else {
    const { problems: bad, unknown } = authSettingsProblems(
      await fetchAuthConfig(url, token, fetchImpl),
    );
    for (const b of bad) problems.push(`Auth setting ${b}`);
    for (const u of unknown) warnings.push(`Auth setting not reported by the API: ${u}`);
  }
  return { problems, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    console.error('server:check needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  const { problems, warnings } = await serverProblems(url, key);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (problems.length) {
    console.error('The Supabase server is not ready for this app:');
    for (const p of problems) console.error(`  ${p}`);
    console.error('See docs/launch-readiness.md ("Migrações pendentes" and "Segurança").');
    process.exit(1);
  }
  console.log(
    `OK: the server has the ${EXPECTED.length} functions from the latest migrations and captcha is on`,
  );
}
