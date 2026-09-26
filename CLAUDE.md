# TapStrong — instructions for Claude Code

The owner is Daniel. He writes in Portuguese: reply in Brazilian Portuguese, and keep code, comments and commits in English.

The full spec is in `docs/SPEC.md`. Read it before any task, and follow it over any assumption of your own.

## Working rules

- Build in the phases of SPEC §12, one phase at a time. At the end of each phase:
  - run lint, typecheck and tests;
  - commit;
  - write a short Portuguese report in `docs/progress.md` (done / how to test / open questions);
  - stop for Daniel's OK.
- Exercise ↔ muscle mapping comes only from the database, and only `released` exercises reach users. Never invent exercises or muscles in code or in AI prompts.
- The Claude API key and every other secret live in `.env` or Supabase secrets. Never commit them, and never put them in the app bundle.
- All user-facing text goes through i18n (`en` first). No hard-coded strings.
- Follow the design tokens and accessibility rules in SPEC §2 and §4. Visual reference: `docs/mockups/` (see its README).
- Ask Daniel before:
  - adding a paid service;
  - changing the stack;
  - deleting data or migrations;
  - anything touching payments, store accounts, or child-data rules.
- Every generated session has a warm-up first and a cool-down last, adapted to age mode (SPEC §8, "Warm-up & cool-down"). "Only 15 min" may shorten them, never remove them.
- Keep the generator deterministic and unit-tested. Safety filters (restrictions, conditions, age) must have tests.
- Media assets: body images are in `assets/bodies/`, copied from `C:\Users\danie\OneDrive\Daniel\Aplicativo\App Gym Flex\Imagens`. The `ex-*.mp4` files there are prototype placeholders only.

## Commands
- dev: `npx expo start`
- test: `npm test`
- typecheck: `npx tsc --noEmit` (or `npm run typecheck`)
- lint: `npm run lint` (Prettier runs inside ESLint; `npm run format` to fix)
- all three: `npm run check`
- database: `npm run db:test` — applies `supabase/migrations` to a throwaway local Postgres and runs `supabase/tests/local/*.sql` (RLS + child-data constraints)
- install packages with `npx expo install <pkg>`; if the Expo API is unreachable, prefix `EXPO_OFFLINE=1`

@AGENTS.md
