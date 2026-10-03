# TapStrong — security rules

These rules hold for every phase (security round 1, Phase 24). Each one says
how the app meets it and what checks it automatically. A change that breaks a
rule needs Daniel's OK and a line here.

Automatic checks:

- `npm run security:check` (part of `npm run check`): secrets in tracked files,
  git history (merge commits included) and (with `--bundle <dir>`) an export;
  HTML / eval / script-injection / `injectedJavaScript` / `srcdoc` /
  WebView sinks outside a per-sink allowlist; every dependency in `package-lock.json` with an
  integrity hash; `npm audit --omit=dev` with no high or critical issue.
- `npm run db:test`: all migrations plus the SQL tests, ending with
  `supabase/tests/local/zz_security_policies.sql` (RLS, WITH CHECK, SECURITY
  DEFINER, anon grants).
- `npm run bundle:check` (also part of `npm run check`): the release
  bundles for iOS, Android and web carry no drafts and no secrets.
- Pre-commit hook (`.githooks/pre-commit`, installed by `npm ci`): no secret in
  the lines being committed. Needs `node`; skipped by `--ignore-scripts` and
  when another `core.hooksPath` is set (README, "Pre-commit secret scan").
- `npm run web:check`: the page's CSP hashes match its inline scripts, on the
  development and the production export, and the CSP blocks nothing the app
  needs.

## 1. XSS — no untrusted HTML

- Screens render through React / React Native only. User text is never
  inserted as HTML.
- `dangerouslySetInnerHTML` only in `src/app/+html.tsx`, with constant script
  and CSS written in that file. The only WebView is the Turnstile widget
  (`src/features/captcha/TurnstileWidget.tsx`): Cloudflare's page, no
  navigation away.
- The web page ships a Content-Security-Policy (`src/lib/csp.ts`): scripts from
  our own origin plus the two inline scripts by SHA-256 hash (no
  `unsafe-inline` / `unsafe-eval` for scripts), `object-src 'none'`,
  `base-uri 'none'`. `connect-src` lists only our Supabase project and the
  PostHog / Sentry hosts set for the build (no wildcards). Host headers add
  `frame-ancestors 'none'`, nosniff, Referrer-Policy and HSTS without
  `includeSubDomains` / `preload` until the domain is decided. `npm run
  web:export` exports, writes the headers (refusing an export whose CSP
  doesn't match its pages) and scans the bundle for secrets (round 2, P3).
- Every `Linking.openURL` target is a constant or built from our own settings.
- Checked by: `security:check` (sinks), `web:check` (CSP).

## 2. Access control — the server decides who sees what

- Row-level security on every table; every write policy has a WITH CHECK.
- Ownership comes from `auth.uid()` only, never from the request body. Per
  profile data goes through `can_access_profile()`.
- Nobody can link a profile to another person's login (`profiles.user_id`),
  set someone else as guardian, or drop their guardian from the client (S1-01,
  S2-01, S2-02). The age mode follows the birth date on the server (S2-03);
  60+ mode needs 60 or more. A profile with a guardian or in teen / child
  mode can move its birth date earlier only through the guardian (a teen with
  their own login: support); every change is logged in
  `profile_birth_changes` (round 2, S2-P2-4).
- The parent PIN is checked on the server (`verify_parent_pin`), with the
  lockout inside the check; clients can't clear locks (S1-03). Until that has
  passed QA on the web, family profiles are mobile-only (`familyAvailable()`).
- Edge Functions verify the JWT and take the user id from it.
- **Premium and the free weekly limit are decided on the phone.** That is
  acceptable for content already in the app. Any paid feature that runs on
  the server must check `public.subscriptions` there, never trust the app.
- Checked by: `db:test` (role-switching SQL tests for every policy, plus
  `zz_security_policies.sql`).

## 3. Keys — only public values in the app

- The app bundle holds only `EXPO_PUBLIC_*` values that are public by design
  (Supabase URL and anon key, RevenueCat public keys, Turnstile site key,
  PostHog / Sentry public keys).
- Secrets live only in Supabase secrets (Claude API key, service role,
  RevenueCat webhook secret, Turnstile secret) or EAS secrets. Never in `.env`
  committed, the chat, or GitHub. `.env` is git-ignored.
- Checked by: `security:check` (files, history, bundle) and the pre-commit hook.

## 4. Database — no open doors

- No table without RLS. No `using (true)` on private data: only reference data
  (`muscles`, released exercises) is readable without login.
- Every SECURITY DEFINER function sets `search_path = ''`, uses `auth.uid()`
  and is never executable by `anon`. Functions only the server may call
  (coach budget, referral rewards) are granted to `service_role` only.
- Views and materialized views clients can read need `security_invoker`
  (materialized views can't have it, so none). Policies must depend on who
  is asking (`auth.*`, `can_access_profile`, `user_id`, owner, guardian);
  a policy without `TO` applies to `{public}`, which includes anon, and is
  treated as anon. These rules cover every non-system schema, not only
  `public` (round 2, S2-P2-7).
- Storage: the only bucket, `exercise-media` (Phase 32), is public to read
  (reference media, no personal data) and has no write policy, so only the
  service role uploads (`scripts/upload-exercise-media.mjs`, run from a
  terminal with the key in its environment). Checked by
  `exercise_media_bucket.sql` with role switching.
- Checked by: `zz_security_policies.sql` in `db:test`, which also plants
  each mistake (a leaking view, `1 = 1`, `not false`, a policy with no
  `TO`, a SECURITY DEFINER function in another schema…) and fails if the
  check misses it.

## 5. SQL — no injection

- No dynamic SQL in migrations or functions. No PostgREST filter built from a
  user string: the app passes values as parameters to supabase-js.
- Checked by: code review (and the SQL tests).

## 6. Limits — every auth and AI route is limited

- Coach (Claude): per user (30/day), per IP (hashed) and global daily budgets
  in `coach_budget`; one try per model with a 20 s timeout; anonymous users get
  the primary model only; 1.5 s between calls in the app (S2-04).
- Anonymous sign-in and email codes: Cloudflare Turnstile, enforced by
  Supabase Auth (on in `config.toml` too). `server:check`, and every
  production build through `env:check`, fails while captcha is off: it asks
  for a code without a captcha token and expects `captcha_failed` (round 2,
  S2-P2-6).
- Email codes (round 2, S2-P2-5, replaces the S2-07 wording): the limits
  that count are Supabase Auth's own, which no client can skip: one email a
  minute per user (`max_frequency` / `smtp_max_frequency` = 60 s), codes
  valid 15 minutes (`otp_expiry` 900 s), code checks and anonymous sign-ins
  30 per IP (5 min / 1 h). With `SUPABASE_ACCESS_TOKEN` in the terminal,
  `server:check` reads these from the Management API and fails on weaker
  values. The app's own counters (5 wrong codes → 15 minutes, via
  `account_code_failed` / `pin_reset_code_failed`) are a courtesy for the
  honest user: a client calling Auth directly skips them. "Send code" stays
  disabled during the minute and the lock.
- Parent PIN: 5 wrong → 15 minutes, enforced by the server.
- Checked by: unit and SQL tests for each limit; `server:check` for the
  Auth settings.

## 7. Prompt injection — the model can't do anything

- The coach wraps the user's text in `<answer>` tags as data; the system prompt
  says to ignore instructions inside it; input is capped at 500 characters.
- Output is constrained by a JSON schema, then allow-listed and clamped
  (`validateOutput`), on the server and again in the app. Teens never get a
  weight-loss goal whatever the model says.
- The model has no tools, never writes to the database and never sets safety
  fields (pain, conditions, restrictions, age mode). The age mode comes from
  the server (S2-05).

## 8. Packages — nothing invented, nothing brand-new

- Before installing a dependency, check it on the registry: it exists, it's
  the well-known package (not a look-alike name), and the version is more than
  7 days old. Use `npx expo install` for Expo modules.
- Install with `npm ci` (exact versions and integrity hashes from the lockfile).
- Dependabot proposes updates only after a 7-day cooldown.
- Edge Functions pin exact versions (`npm:@supabase/supabase-js@2.117.1`,
  `npm:@anthropic-ai/sdk@0.128.0`).
- `npm audit --omit=dev`: 0 high, 0 critical. The 16 moderate ones
  (`decode-uri-component` via expo-router / query-string, `uuid` via xcode /
  `@expo/config-plugins`) are tracked; npm's suggested "fix" is a downgrade of
  Expo packages and isn't applied.
- Tracked high advisory with no patched release (Phase 30, 2026-10-02):
  `node-forge` <=1.4.0, GHSA-86w9-cpqp-85rv (RSA PKCS#1 v1.5 signature
  verification), via `expo` → `@expo/cli` (+ `@expo/code-signing-certificates`).
  It is CLI tooling (dev server, update code signing) and is not in the app
  bundle; 1.4.0 is the latest release, and npm's "fix" is an Expo downgrade.
  Listed in `TRACKED_ADVISORIES` in `scripts/security-check.mjs`, so the check
  warns instead of failing; any other high/critical advisory still fails it.
  Remove the entry once node-forge ships a fix and bump Expo.
- Tracked high advisory (Phase 31, 2026-10-03): `braces` <=3.0.3,
  GHSA-vfj7-8cjw-p6xm (stack exhaustion on deeply nested patterns), via
  `expo` → `@expo/cli` → `@expo/metro-file-map` → `micromatch`. Dev-server file
  watching with the project's own patterns; not in the app bundle. Same rule:
  in `TRACKED_ADVISORIES`, remove once a patched release reaches Expo.
- Checked by: `security:check` (lockfile integrity, audit).

## Known gaps (tracked)

- Web session tokens are in localStorage (Supabase's default on web). The CSP
  lowers the XSS risk that could read them; family profiles stay off the web.
- Linking an adult who has their own login to a family needs an invite/accept
  flow (not built); until then it isn't possible from the client.
- Neck isometric holds exist only in the Repair library, which the weekly
  joint budget doesn't cut (Phase 23 answer 2).
