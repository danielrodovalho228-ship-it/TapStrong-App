# TapStrong — Fase 21 (Daniel, approved)

Daniel's answers to the four Phase 20 questions, plus small round-8 items missing from the Phase 20 report. Separate commits per group, tests for every change, i18n en/es/pt-BR, Portuguese report at the end (docs/progress.md). Round 9 of QA follows.

## 1. Long workout (75–90 min)

- Keep the set cap (4 adults; 3 teens, 60+ and joint care). Don't raise sets and don't add an exercise on its own.
- When the estimate is still under ~85% of the chosen time after the extra sets, the workout list shows "+1 exercise?" prominently (at the top of the list, not hidden at the end). One tap adds the exercise and recomputes the time.
- The estimate shown is the real one (e.g. "~48 min" when 90 was chosen), never the chosen time.
- Tests: 90 min with 5 exercises shows the offer; 30/45 min don't; accepting raises the estimate; teens/60+ see it too, within the 3-set cap.

## 2. Family plan for under-18s

- Hide the Family plan card on /plans (and any other plan list or offer) when the active profile is under 18, including a solo teen and a locked teen. The Family plan owner must be an adult.
- If a minor opens the Family purchase link directly: "An adult needs to buy the Family plan" and go back, no purchase started.
- Tests: solo 17, locked teen, adult (sees the card), owner with a teen active (doesn't see it while the teen is active).

## 3. Weekly set cap per muscle

- Maximum sets per primary muscle in a 7-day window: adults 18–59 = 20; teens = 14; 60+ and joint care = 12.
- Counts working sets (no warm-up or mobility). Applies to the generator, to the short-workout extra sets and to "+1 exercise?" (if the suggested exercise would break the cap, suggest another muscle or nothing).
- Deload keeps cutting sets as today.
- Tests: adult PPL 6 and Upper/Lower 5 never over 20 per muscle; teen 4 days never over 14; 60+ never over 12; the short workout with extra sets respects the cap.

## 4. Videos in Flow

Decided and in production: Veo 3.1 Fast for floor, abs and small movements; Lite for big, simple movements. No code change. Videos will arrive as `<slug>.f.mp4` / `<slug>.m.mp4` for Supabase Storage with a manifest; separate text when the first ones are downloaded.

## 5. Round 8 items not in the Phase 20 report (confirm or fix)

- R8-04: clock-based text (trial end date, week strip) only after hydration; no build-day date in the static HTML, no #418 the next day.
- R8-05: after the email code is accepted, the OTP session is signed out.
- Loads: the rest screen "Try +X" matches the list after switching lb/kg.
- "Exercise not found" uses a neutral notice, not the green success one.
- Terms/Privacy: disabled links hidden when the URL is unset.
- Band lat pulldown: "sit or stand" (not "kneel"), especially for 60+.
- A workout not finished that moves to tomorrow: tomorrow's preview must not say "Rest day".
- For each: "already done (commit X)" or "fixed now".

## Checks at the end

Full jest, lint, typecheck, db:test, functions:check, bundle:check, web:check, tabs:check, theme:check. Push to the same branch and write the report.
