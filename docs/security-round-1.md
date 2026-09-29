# TapStrong — Phase 24: Phase 23 answers + security round 1

Relayed by Daniel after approving Phase 23. Daniel's choices confirmed in chat
(Phase 24 start): captcha = **Cloudflare Turnstile**; web host = **not decided
yet** (CSP as a meta tag in the page, header files prepared for Vercel and
Netlify/Cloudflare Pages).

Order: P1, then P2, then P3, then the permanent protections. Separate commits
per group, tests for every fix (SQL tests with role/user switching for every
new policy), i18n en/es/pt-BR, Portuguese report at the end.

## Answers to the Phase 23 questions

1. **Kneeling:** still counts toward the knee budget (knee push-ups, bird dog
   etc.). Kneeling with weight on the knee hurts many people with anterior knee
   pain; it is the safest choice.
2. **Neck:** fine, just record it in the docs.
3. **Supabase migration:** Daniel runs `supabase db push` himself before the
   next test build. Write in docs/launch-readiness.md the exact list of pending
   migrations and the command, and make `env:check`/the build fail with a clear
   message if the app detects that the new table/function does not exist on
   the server (or at least report it to Sentry).

---

# Security round 1 (HEAD 621e173)

Two reviewers audited the code against the 8 most common attacks on AI-built
apps (XSS, exposed API routes/IDOR, exposed keys, open database, SQL
injection, no rate limits, prompt injection, invented packages). Migrations
and SQL tests ran on a throwaway local Postgres 16 with role-switching probes;
a fresh web export was built and inspected; nothing live was contacted.

## P1

- **S1-01 A guardian can attach a managed profile to someone else's login
  (account takeover).** `supabase/migrations/20260926000000_foundations.sql:237-240`
  (`profiles_update`: `user_id = uid OR guardian_id = uid`) + guard trigger
  `20261001000000_billing_family.sql:276-278` fires only on `mode`/`guardian_id`
  changes, so a guardian can set `user_id` of a managed profile to any user id.
  The victim's app looks up its profile by `user_id`
  (`src/features/account/cloud.ts:131`, `sync.ts:393`), adopts the planted
  profile, and the attacker keeps full read/write (health screen, pain reports,
  workouts) through `guardian_id`; it also blocks the victim from creating a
  real profile (`user_id` is unique). The victim's id leaks through
  `referrals_read_own` (`20260930000000_account_growth.sql:49-54`,
  `invited_user_id`). Fix: `user_id` may only stay the same or become
  `auth.uid()` (policy `with check` + trigger); stop exposing `invited_user_id`
  (view/RPC with counts/dates only). SQL test: guardian tries to set `user_id`
  to another user → denied.
- **S1-02 RevenueCat sandbox purchases count as a real paid Family plan.**
  `supabase/functions/_shared/billing.ts:74-76, 155-168`: SANDBOX events are
  only relabelled `store='test'` but still set `plan='family'`,
  `status='active'` and `first_charged_at`. TestFlight/Play test purchases are
  free → free Family plan on the server and a bypass of the paid-parent
  evidence used for child consent. Fix: in production ignore events whose
  `environment !== 'PRODUCTION'` (or route sandbox to a separate
  webhook/project); never set `first_charged_at` from a test store. Test both
  environments.
- **S1-03 On web the parent PIN and teen gates can be bypassed from the
  browser console.** `src/lib/secureStorage.ts:13` falls back to `kvStorage`
  (localStorage) on web, so the PIN hash/salt/failures/`lockedUntil`
  (`src/features/family/parentPin.ts:48-57`) are editable; a teen can
  brute-force the 4-digit PIN offline, overwrite the hash or reset the lock.
  The server lockout is advisory (the client reports its own results,
  `pinLockout.ts:40-45`; `parent_pin_passed` is client-callable). **Daniel's
  decision:** (a) verify the PIN on the server on every platform: store a
  PBKDF2/argon2 hash in the DB (owner-only, never readable by clients), add
  `verify_parent_pin(pin)` (SECURITY DEFINER, `search_path=''`, `auth.uid()`),
  with the lockout (5 wrong → 15 min, separate counter from the email code)
  enforced inside it; remove client calls to
  `parent_pin_passed`/`pin_reset_code_passed`; keep an offline fallback on
  native only (Keychain/Keystore) that re-syncs; (b) until (a) ships and passes
  QA, **family, teen and child profiles are hidden on web** (web = adults
  without family): no Family tab, no profile switch, no ParentGate,
  `/family/*` routes redirect Home on web, with a note "Family profiles are
  available in the mobile app".

## P2

- **S2-01 A user can add their own profile to a stranger's family.** Same
  `profiles_update` + `guard_managed_profiles`: user C sets `guardian_id` on
  C's own profile to any adult D with a Family plan; only D's plan/adulthood is
  checked, not D's consent. Takes D's slots (repeat → denies the whole plan)
  and pushes C's data into D's account. Fix: only a guardian may set
  `guardian_id`, and only to themselves; linking an adult with their own login
  goes through an invite/accept RPC.
- **S2-02 A teen with their own login can remove their guardian**
  (`update profiles set guardian_id = null` succeeds for `user_id`; the trigger
  ignores null). Fix: only the current guardian (or a guardian-approved RPC)
  may change `guardian_id`.
- **S2-03 Age mode not tied to birth date on the server.**
  `foundations.sql:81-83`, `20261006000000_qa1_safety.sql` (child-only guard),
  `20261003000000_progress_repair.sql:27-44`: a profile born 2014 can be
  inserted as adult; a guardian can switch a managed teen (2011) to adult and
  store waist/BMI/weight check-ins; the minors' body-data rule only looks at
  `mode`. Fix: trigger deriving `mode`/`body_band` from
  `birth_year`/`birth_month` (an adult may choose senior; a minor can never be
  adult); `guard_checkin_body_fields` computes age from the birth date.
- **S2-04 Coach AI cost abuse with fresh anonymous accounts.**
  `supabase/config.toml` (`enable_anonymous_sign_ins = true`,
  `anonymous_users = 30`/h/IP, no captcha) + `coach-interview/index.ts:41,132`
  (30 calls/day per user): ~900 LLM calls/h/IP, each can fall back from Haiku
  to Sonnet with 1024 output tokens. Fix: captcha (Cloudflare Turnstile —
  Daniel's choice) on anonymous sign-in and email OTP; per-IP and global daily
  budget in `coach-interview` (DB counter, return 429 + friendly message);
  explicit SDK `timeout` and `maxRetries: 0`; anonymous users get the primary
  model only; small client cooldown for UX.
- **S2-05 The coach trusts the age mode sent by the app.**
  `_shared/interview.ts:242-244` takes `mode` from the body (only `child`
  rejected): a child can send `teen`, a teen `adult` (adult goals,
  height/weight questions); the teen rule "never lose_weight" lives only in the
  prompt and client (`chat.tsx:99`). Fix: derive the mode on the server from
  the caller's profile (JWT user); `validateOutput` removes `lose_weight` for
  teens.
- **S2-06 Web: session tokens in localStorage and no CSP.**
  `src/lib/supabase.ts:19` (`storage: kvStorage` = localStorage on web); the
  exported HTML has no Content-Security-Policy and the repo has no hosting
  headers. Fix: ship headers from the host (host not decided: files for Vercel
  and Netlify/Cloudflare Pages) and a meta fallback in `src/app/+html.tsx`:
  `default-src 'self'; script-src 'self' <sha256 of the static inline scripts,
computed at build>; connect-src 'self' https://<ref>.supabase.co
wss://<ref>.supabase.co https://*.posthog.com https://*.ingest.sentry.io;
img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src
'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`, plus
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, HSTS. Add a `web:check` step that fails if
  the hashes don't match the inline scripts.
- **S2-07 Email OTP login (Account) has no resend cooldown or verify limit**
  (`src/features/account/auth.ts:47,67`, `src/app/account.tsx:169,190`); local
  config has captcha off, `otp_expiry = 3600`, `token_verifications = 30`/5
  min/IP. Fix: 60 s resend timer and lock verify for that email after 5 wrong
  codes (server-side counter); in docs/launch-readiness.md list the production
  dashboard settings for Daniel: captcha on, OTP expiry 10–15 min, rate limits
  confirmed.

## P3

- **Referral farming:** `sessions.status='done'` is client-writable and
  trusted by `first_completed_workout`; `redeem_referral` accepts any account
  (anonymous, any age) and email sign-up has `enable_confirmations = false`;
  the inviter cap (4 weeks/year) is checked non-atomically
  (`referral-reward/index.ts:266-283`). Fix: confirmed email, redemption only
  within N days of account creation, a completed workout must have ≥ N logged
  sets over ≥ 10 min, cap check-and-increment in one statement/row lock.
- **RevenueCat TRANSFER ignored** (`billing.ts:90`): expire the
  `transferred_from` users.
- **Account deletion deletes teens' own profiles:** `profiles.guardian_id ...
on delete cascade`; use `set null` (or detach) when the teen has their own
  `user_id`.
- **Password policy:** `minimum_password_length = 6`, no
  `password_requirements`, `secure_password_change = false` → 10+ chars,
  letters+digits, secure change on.
- **Premium/free cap decided on the client** (`billing/store.ts:43-56`,
  `rules.ts:48`, editable storage on web): acceptable for bundled content; any
  paid server feature must check the DB subscription (document the rule).
- **Under-13 lock local** (`ageBlock.ts:36`): if self-signup ages are ever
  synced, the server refuses a birth date under 13 unless the kids switch and
  parent consent exist.
- **Dependencies:** pin `npm:@supabase/supabase-js` to the exact version in the
  Edge Functions source (not `@2`); docs/README use `npm ci`; add a minimum
  release age (e.g. 7 days) for dependency updates; `npm audit --omit=dev` = 0
  critical/high, 16 moderate (decode-uri-component via
  expo-router/query-string, uuid via xcode/@expo/config-plugins) — track, don't
  apply npm's bogus downgrade.

## Permanent protections (new, for every future phase)

1. **docs/SECURITY.md** with the 8 rules and how this app meets each:
   (1) XSS — React-only rendering, no `dangerouslySetInnerHTML` except the
   audited `+html.tsx`, CSP; (2) access control — RLS on every table,
   `with check` on every write policy, ownership from `auth.uid()` only, never
   from the request body; (3) keys — only `EXPO_PUBLIC_*` publishable values in
   the app, secrets only in Supabase/EAS secrets; (4) database — no table
   without RLS, no `using (true)` on private data, SECURITY DEFINER with
   `search_path=''`; (5) SQL — no dynamic SQL, no PostgREST filters built from
   user strings; (6) limits — every auth and AI route has per-user + per-IP +
   global limits; (7) prompt injection — user text delimited as data, output
   schema-validated and allow-listed, model has no tools/DB writes and never
   sets safety fields; (8) packages — every new dependency verified on the
   registry (exists, well-known, not a look-alike, > 7 days old) before
   installing.
2. **`npm run security:check`** (run in `check`): fails if (a) any public table
   lacks RLS or has a policy with `using (true)` outside the reference-data
   allowlist, or a write policy without `with check` (query the local DB after
   `db:test`); (b) any SECURITY DEFINER function lacks `search_path` or is
   executable by `anon`; (c) the web bundle or repo contains key patterns
   (`sk-`, `sk_live`, `rk_live`, `sb_secret_`, service_role JWT, `AIza`,
   `ghp_`, `whsec_`) — use a secret scanner (gitleaks) over git history too;
   (d) `dangerouslySetInnerHTML`/`innerHTML`/`eval`/WebView appear outside the
   allowlist; (e) a dependency in package.json isn't in the lockfile with an
   integrity hash; (f) `npm audit --omit=dev` has high/critical.
3. **Pre-commit**: gitleaks on staged files.
4. **SQL tests** for every policy: stranger read/write denied, guardian limited
   to its own managed profiles, teen cannot change `guardian_id`/`mode`/`user_id`.

## What passed (keep it that way)

RLS on all 31 public tables; per-profile data via `can_access_profile` with
`using` + `with check`; only released reference data readable without login;
subscriptions/referrals/consent not client-writable; every SECURITY DEFINER
function has `search_path=''`, uses `auth.uid()`, none executable by anon; no
dynamic SQL and no filters built from user strings; Edge Functions verify the
JWT and take the user id from it; delete-account deletes only the caller;
referral-reward blocks anonymous and self-referral and claims atomically;
RevenueCat webhook secret compared in constant time; coach prompt wraps user
text in `<answer>` tags as data, output constrained by JSON schema then
allow-listed and clamped, no tools, no DB writes, 500-char input cap; no
secrets in 132 commits of history, `.env` ignored, only publishable keys
bundled; no XSS sinks with user data, all `openURL` targets constant; 60 direct
dependencies are real, well-known packages with integrity hashes; native PIN in
Keychain/Keystore with PBKDF2 100k.
