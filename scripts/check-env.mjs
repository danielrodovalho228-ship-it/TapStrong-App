// Required public variables for a store build (QA R7 P2). They live in the
// EAS environment, not in .env (.env stays on this computer). Secrets never
// go here: they are Supabase secrets.
//   npm run env:check              → lists what is missing, exits 1 if any
//   --if-production (EAS hook)     → only enforced on the production profile
const REQUIRED = [
  ['EXPO_PUBLIC_SUPABASE_URL', 'account, sync and functions'],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'account, sync and functions'],
  ['EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'subscriptions on iOS'],
  ['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'subscriptions on Android'],
  ['EXPO_PUBLIC_TERMS_URL', 'Terms of Use link (store requirement)'],
  ['EXPO_PUBLIC_PRIVACY_URL', 'Privacy Policy link (store requirement)'],
  ['EXPO_PUBLIC_SUPPORT_EMAIL', 'support contact'],
  ['EXPO_PUBLIC_SHARE_BASE_URL', 'invite links'],
  // Security round 1 (S2-04, S2-07): Turnstile before anonymous sign-in and email codes.
  ['EXPO_PUBLIC_TURNSTILE_SITE_KEY', 'person check (Cloudflare Turnstile)'],
];
const OPTIONAL = [
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_TURNSTILE_BASE_URL',
];

const onlyProduction = process.argv.includes('--if-production');
const profile = process.env.EAS_BUILD_PROFILE;
if (onlyProduction && profile !== 'production') {
  console.log(`env:check skipped (build profile: ${profile ?? 'local'})`);
  process.exit(0);
}

const missing = REQUIRED.filter(([name]) => !process.env[name]?.trim());

// Present is not enough (QA R8 P2): the links must be real https pages, and
// support must be a business address, never a personal mailbox.
const HTTPS = ['EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SHARE_BASE_URL'];
const PERSONAL =
  /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|gmx|mail|yandex|zoho|bol|uol|terra)\./i;
const invalid = [];
for (const name of HTTPS) {
  const v = process.env[name]?.trim();
  if (!v) continue;
  let ok = false;
  try {
    const u = new URL(v);
    ok =
      u.protocol === 'https:' &&
      !!u.hostname &&
      !/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname);
  } catch {
    ok = false;
  }
  if (!ok) invalid.push([name, 'must be a public https:// address']);
}
const support = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
if (support && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(support))
  invalid.push(['EXPO_PUBLIC_SUPPORT_EMAIL', 'is not an email address']);
else if (support && PERSONAL.test(support))
  invalid.push(['EXPO_PUBLIC_SUPPORT_EMAIL', 'must be a business address, not a personal mailbox']);
for (const name of OPTIONAL)
  if (!process.env[name]?.trim()) console.log(`optional, not set: ${name}`);
if (missing.length) {
  console.error('Missing required EXPO_PUBLIC_* variables for a production build:');
  for (const [name, why] of missing) console.error(`  ${name}  (${why})`);
  console.error('Set them in the EAS environment (docs/launch-readiness.md, "Variáveis do app").');
  process.exit(1);
}
if (invalid.length) {
  console.error('Invalid EXPO_PUBLIC_* variables for a production build:');
  for (const [name, why] of invalid) console.error(`  ${name}  ${why}`);
  process.exit(1);
}
console.log('OK: every required EXPO_PUBLIC_* variable is set');

// A production build also checks that the server has the latest migrations
// (Phase 23 answer 3): never ship against a server missing them.
if (onlyProduction) {
  const { missingOnServer } = await import('./check-server.mjs');
  const missingFns = await missingOnServer(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ).catch((e) => {
    console.error(`Could not reach the Supabase server to check migrations: ${e.message}`);
    process.exit(1);
  });
  if (missingFns.length) {
    console.error('The Supabase server is missing migrations this app needs:');
    for (const [m, fn] of missingFns) console.error(`  ${m}  (function ${fn})`);
    console.error(
      'Run `supabase db push` first (docs/launch-readiness.md, "Migrações pendentes").',
    );
    process.exit(1);
  }
  console.log('OK: the server has the latest migrations');
}
