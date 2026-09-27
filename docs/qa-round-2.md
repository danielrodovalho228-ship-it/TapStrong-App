# TapStrong — QA round 2 (20 personas, web dev build of 95b4d85)

Phase 11 instructions (Daniel): follow this in order — section 0 (owner request), P0, P1, P2 — together with the decisions already approved by Daniel:

1. A short mobility session (~10 min) counts as an active day on the free plan, with no limit; the 3 full workouts per week stay. Tests for the limits.
2. Repair phases 2 and 3 get ≥ 3 exercises per movement in each phase, all draft, with a coverage test for both phases and a regenerated reviewer spreadsheet.

Separate commits per group, tests for every safety fix, report in Portuguese at the end.

---

Four testers re-ran the personas at 390×844 with supabase.co blocked. Most of round 1 is fixed. What remains, in priority order:

## 0. Owner request (same priority as P0)

**O-1b. The recovery map still does not look like the body map.** Daniel rejected it twice. Today's Home card draws a small body thumbnail with large dots that overlap and cluster (chest is one red lump). He wants it to look exactly like `/body`:

- Reuse the same `BodyMapCanvas` rendering (same image, same `hotspots.json` positions, same dot style), not a separate drawing.
- **Dot size is proportional to the body image**, the same ratio as on `/body` (small white dot with a thin dark ring). Never a fixed pixel size on a small thumbnail.
- **Recovery state = the dot's fill plus a soft halo**, exactly like a selected dot on `/body`: red / orange / peach / grey-blue fill with a light halo around it. Untrained or neutral muscles stay as the small white dots. No blurred areas, no big coloured circles.
- **Size:** on Home, the body takes the full card width (legend below the body, not beside it), so the dots are well spaced. Same on Done and Share.
- Keep the Front / Back toggle.
- Add a legend entry for the white dots ("Recovered / ready").
- Add a snapshot/visual test comparing the recovery body with `/body` at the same size (dot radius ratio and positions equal).

## 1. P0

- **R2-01 Teens (13–17) cannot be added to a family.** Family → Add → My child, born 2012 → the who screen locks the date ("stays in kids mode until 13"), Continue disabled; the dead profile takes one of the 5 slots for good (no remove UI). Cause: `onboarding/who.tsx:34` locks any `kind:'child'`, and `age-gate.ts:38` returns `child_locked` for age ≥ 13. Fix: lock under-13 consented profiles against moving to 13+; teen profiles lock within 13–17. Add "Remove member" (parent gate) so slots can be freed. Tests for both.
- **R2-02 Sharp-pain stop does not exclude by `joint_movements`.** Same day after a sharp knee stop, Home offers Quads & Hamstrings with heavy Machine leg extension; after a sharp lower-back stop, Barbell hip thrust stays. Cause: `workout/hooks.ts:43-45` adds sharp-stop areas as soft restrictions; `generator/filters.ts:31-40` checks only `contraindications`. Fix: apply the joint-movement check to `sharpStopAreasToday` (and `dullPainAreasToday`). Tests.

## 2. P1

**Safety and family**

- **R2-03 Child can change the parent's subscription.** `/paywall` is not wrapped in `OwnerOnly`: a child switched Family → Premium. Also the paywall says "Free plan · 3 workouts this week" to a Family subscriber.
- **R2-04 A minor can give COPPA consent.** A 17-year-old owner on a Family plan created a child profile. Check owner age ≥ 18 in `family/add.tsx`, `childConsentBlocker` (`family/rules.ts:17`) and the DB function `create_child_profile`. Test.
- **R2-05 Parent gate is too weak.** A multiplication 6–9 × 7–9, seeded by the minute, unlimited retries. Use a parent PIN set by the owner (or re-auth), with a lockout after 5 wrong tries.
- **R2-06 Balance / fall-prevention is dropped first by the time fit.** Rosa (68, fell, with support, balance goal, 30 min) gets no balance exercise. `generate.ts:383-399` appends it at the end; the trim loop at `:440-449` pops it. Protect it.
- **R2-07 Restricted joints still get heavy loading.** Knee restriction → Machine leg extension 3 × 4–8 heavy + ramp-ups; Sit to stand as a pain swap. Lower back → hip thrust, seated hamstring stretch. Laura (painful "raise arm to the side") → Supported leaning lateral raise 3 × 4–8 + ramp-ups while her recovery plan is in holds-only phase 1. Rule: moves that load a restricted or painful joint get a light dose (12–15, no ramp-up), and moves that use the painful movement are excluded while the recovery plan is in phase 1. Reviewer to confirm.
- **R2-08 Same muscle again the same day / ignoring recovery.** When every goal muscle was trained today (`generate.ts:307-320`, the `notToday.length ? notToday : fresh` fallback), Home and Start give the same muscles again (Alex: 5 chest lifts minutes after chest; 60+: quads next morning despite 96 h). Choose targets by recovery hours; if nothing is recovered, offer mobility, balance, cardio or a rest day.
- **R2-09 Push-heavy weeks.** Each chest sub-region is its own target, so a chest day has 3 chest presses and the week is ~11 push : 5 pull : 5 legs (`generate.ts:296-345`). Pick one exercise per parent muscle per session (rotate sub-regions across sessions) and keep push/pull/legs balanced.
- **R2-10 Chosen muscle dropped silently.** Joe (seated, Quads + Glutes) never gets glutes and no note says why (`generate.ts:361-374`); a no-equipment user lost Quads to 3 chest sub-regions. Always explain, and add seated bodyweight glute options.
- **R2-11 Kids never get the game warm-ups; adults do.** `pickGeneralWarmup` (`generate.ts:237-248`) sorts so `jumping_jacks` always wins for kids; `kid_*` moves have `minAgeBand: kid` so they reach adults and seniors ("Penguin march" for a 68-year-old). Kids prefer `kid_*` warm-ups and cool-downs; `kid_*` only for 9–12 (maybe 13–15).
- **R2-12 Family tab setState error still happens.** `family/components/FamilyStrip.tsx:20` calls `ensureSelfProfile()` during render (also used on `/plans`). The dev error toast then blocks the tab bar.

**Library (O-3 not met yet).** The 536-exercise library passes the repo's `coverage.test.ts`, but that test checks less than O-3. Audit results:

- Main work, standing: fine. Supported bodyweight: 16/23 muscles below 5. Seated bodyweight: 21/23 below 5 (glutes, hamstrings, lower back: 0). Seated gym: lower back 0.
- Swap sheet: Seated knee extension 0 options; Low palm press hold 2; Cat-cow (home, bands) 2.
- Repair phase 2: 19/41 movements below 3; phase 3: 23/41 below 3 (all neck movements 0) → covered by approved decision 2.
- Seated stretches: quads 0, most groups 1; no knee or rotator-cuff stretches.
- 115 exercises have empty `contraindications`, 32 of them main moves (e.g. `one_arm_dumbbell_row`, `seated_cable_row`, `sit_to_stand`, `band_face_pull`); `neutral_grip_machine_chest_press` lacks `shoulder`.
- Duplicate display names (EN "Low step-up" ×2; PT "Polichinelo sem salto" ×2).
- Make the coverage test check what O-3 asks: ≥5 per muscle × role × equipment × position cell (or a documented exemption list), phases 1–3 per movement, seated stretches per group.

## 3. P2 (batch)

- **Recovery legend:** secondary muscles worked minutes ago read "1–2 days ago" (`recovery.ts:95-98` shifts them 24 h; `home.tsx:73-92` labels describe elapsed time). Label by state ("recovering / ready"), not by fake elapsed time.
- **Home card minutes** use the profile setting (60) instead of the session (50) (`home.tsx:133,137`).
- **No variety:** Ken got the same 2 sessions alternating for 3 weeks (`generate.ts:343` always takes the top-ranked exercise). Rotate among the top options week to week.
- **Same move repeated in one session:** Brisk walk as warm-up, finisher and cool-down; Jumping jacks as warm-up and finisher (`generate.ts:472`, warm-up picked after the finisher without excluding used ids).
- **Dosing:** isolation moves dosed as heavy strength (cable fly, barbell curl 4 × 4–8 heavy); senior bodyweight/band work with 120 s rest; Seated diagonal press dosed in reps but cued as a 5 s hold.
- **Recovery session** (phase 1) gets 3 exercises instead of 4, shows "balance" and "shortened" notes, and includes Decline push-up hold (shoulder-contraindicated).
- **"Only 15 min"** leaves 3 min unused and drops abs.
- **Ramp-up row** for exercise 2 appears before exercise 1 when exercise 1 is bodyweight.
- **Swap sheet:** stretch swaps labelled "same muscle" offer other muscles; neck stretch offers triceps/biceps/shoulder stretches; Brisk walk warm-up swap offers cool-down moves.
- **Share card** picks muscles alphabetically on ties (lats beat goal targets); use session target order (`progress/stats.ts:75-77`).
- **Done stat tile** "3 · PEITO INFER…" has no unit and is cut off (`done.tsx:182`). Duplicate label "UPPER CHEST · ALSO UPPER CHEST".
- **Morning check** has no Home prompt (only Progress → Recovery plan).
- **Pregnancy flag** survives an age change to 60+ (`onboarding/store.ts:97-108`).
- **"Back to my restrictions"** after a red flag lands on /progress (`movement-pain/index.tsx:149`, `router.back()`).
- **Copy:** kids' body toggle says Male/Female (use Boy/Girl); "change body or age anytime" shown to locked child profiles; consent URL with age 6 says "only for children under 13" (should say minimum age 9); kid swap cues use adult rehab wording; "Strengthen (Repair)" label for "Get stronger" users; teen notice mentions "body-fat numbers".
- **PT/ES:** "1 DIAS SEGUIDOS" / "1 DÍAS SEGUIDOS" (`pt-BR.json:2588`, `es.json:2588`); ES "ponerlos" → "ponerlas" (`es.json:2803-2804`); ES "Zona lumbar" vs "Espalda baja", pick one.
- **Accessibility:** tab labels clipped (`(tabs)/_layout.tsx:24-29`, no lineHeight); RadioCard exposes `aria-checked=null` on web (`RadioCard.tsx:20`); unnamed focusable 273×490 div on the body map (`BodyMapCanvas.tsx:144-148`, needs `focusable={false}`); duplicate names "None" ×2 (safety), "Back" ×2 (/body), "Swap Brisk walk" ×3.
- **Milestone** deep link with a 1-day streak says "A full week of showing up".

## What passed in round 2

A-01 stale workout, A-02/C-02 red flag by joint movements, A-04 morning check logic, A-05 dull-pain safe swap, A-07 cardio finisher, A-09 Spanish pain wording, A-11 warm-up swap region, O-2 thumbnail + demo on every row, O-3 swap ≥5 on 40+ items (7 lateral raises), B-01 child lock (under 13), B-02, B-03 (except paywall), B-04, B-05, B-06, minors limited to kid/teen bodies, child/teen restrictions, 5-profile limit, C-03, C-04, C-05, balance holds 20–40 s, C-08, C-09, C-10, 96 h recovery for 60+, D-02, D-03 parent rule, D-04, D-05, keyboard-only workout, free 3/week + paywall, prices and trial date, translations, bundle:check clean.
