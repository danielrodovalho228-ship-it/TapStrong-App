# TapStrong

**Tap. Talk. Train.** A fitness app for ages 9 to 75+. Expo + React Native + TypeScript, Supabase backend.

- Product and build spec: [`docs/SPEC.md`](docs/SPEC.md)
- Phase reports: [`docs/progress.md`](docs/progress.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Getting started

```bash
npm ci                 # exact versions from package-lock.json (security round 1)
cp .env.example .env   # optional: Supabase URL + anon key
npx expo start
```

## Checks

```bash
npm run check    # lint + typecheck + Edge Function check + unit tests + security + release bundle
npm run db:test  # migrations + RLS tests on a local Postgres
```

### Pre-commit secret scan

`npm ci` points git at `.githooks/`, whose `pre-commit` runs
`node scripts/security-check.mjs --staged` (no secret in the lines being
committed). It needs `node` on the PATH of whatever runs `git commit` (GUI
clients too). Two cases where it is **not** installed:

- `npm ci --ignore-scripts` (or `ignore-scripts=true` in `.npmrc`) skips the
  installer: run `node scripts/install-hooks.mjs` once.
- A `core.hooksPath` already set (Husky or another hook manager) is left
  alone: add the line above to that pre-commit hook.

## Layout

```
src/app/            routes (expo-router)
src/components/ui/  base components (Button, Chip, Card, Header, IconButton, AppText, Icon)
src/theme/          brand tokens and contrast helpers (SPEC §4)
src/i18n/           i18next setup and en / es / pt-BR strings
src/lib/            env and Supabase client
src/stores/         Zustand stores
src/features/        feature logic (onboarding, profile, muscles, bodymap)
supabase/           config, migrations, SQL tests, Edge Functions
```

Secrets never go in the repo or the app bundle. The Claude API key is a Supabase secret used only by Edge Functions.
