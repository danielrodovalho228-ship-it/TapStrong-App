# TapStrong

**Tap. Talk. Train.** A fitness app for ages 9 to 75+. Expo + React Native + TypeScript, Supabase backend.

- Product and build spec: [`docs/SPEC.md`](docs/SPEC.md)
- Phase reports: [`docs/progress.md`](docs/progress.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Getting started

```bash
npm install
cp .env.example .env   # optional: Supabase URL + anon key
npx expo start
```

## Checks

```bash
npm run check    # lint + typecheck + unit tests
npm run db:test  # migrations + RLS tests on a local Postgres
```

## Layout

```
src/app/            routes (expo-router)
src/components/ui/  base components (Button, Chip, Card, Header, IconButton, AppText, Icon)
src/theme/          brand tokens and contrast helpers (SPEC §4)
src/i18n/           i18next setup and en / es / pt-BR strings
src/lib/            env and Supabase client
src/stores/         Zustand stores
supabase/           config, migrations, SQL tests
```

Secrets never go in the repo or the app bundle. The Claude API key is a Supabase secret used only by Edge Functions.
