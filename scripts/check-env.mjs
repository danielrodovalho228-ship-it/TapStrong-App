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
];
const OPTIONAL = ['EXPO_PUBLIC_SENTRY_DSN', 'EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_POSTHOG_HOST'];

const onlyProduction = process.argv.includes('--if-production');
const profile = process.env.EAS_BUILD_PROFILE;
if (onlyProduction && profile !== 'production') {
  console.log(`env:check skipped (build profile: ${profile ?? 'local'})`);
  process.exit(0);
}

const missing = REQUIRED.filter(([name]) => !process.env[name]?.trim());
for (const name of OPTIONAL)
  if (!process.env[name]?.trim()) console.log(`optional, not set: ${name}`);
if (missing.length) {
  console.error('Missing required EXPO_PUBLIC_* variables for a production build:');
  for (const [name, why] of missing) console.error(`  ${name}  (${why})`);
  console.error('Set them in the EAS environment (docs/launch-readiness.md, "Variáveis do app").');
  process.exit(1);
}
console.log('OK: every required EXPO_PUBLIC_* variable is set');
