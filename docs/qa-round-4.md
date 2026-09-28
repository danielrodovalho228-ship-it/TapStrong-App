# TapStrong — QA round 4 (web dev build of a786f23)

Received from Daniel with the Phase 15 approval: "Fase 15, aprovada. […] corrija nesta ordem: P1 de segurança, outros P1, depois P2. Commits separados por grupo, testes para cada correção de segurança, i18n en/es/pt-BR, relatório em português no fim."

Four testers ran the personas at 390×844 with supabase.co blocked. All Phase 13 fixes hold. Most of Phase 14 works. No P0. What remains:

## P1 — safety

- **R4-01 Lower-back tag gaps.** After a sharp lower-back stop, Single workout → Lower back gives "Standing bird dog". `bird_dog`, `standing_supported_bird_dog`, plank, side plank, goblet carry hold have lowerBack as primary but no `lower_back` joint tag/contraindication, so `filters.ts:49-55` misses them.
- **R4-02 Knee tag gaps.** No knee tag on: dumbbell single-leg deadlift, single-leg balance, supported single-leg calf raise, heel walk, dumbbell farmer walk, supported heel-to-toe walk, fast march / march in place, low-impact jacks. They reach Dave the same day after a sharp knee stop. Fix these and add an audit test: every exercise whose primary muscle is quads/hamstrings/glutes/calves/shins or with a standing locomotion/single-leg pattern must carry knee/ankle joint tags; every exercise with lowerBack as primary must carry `lower_back`.
- **R4-03 Custom exercises bypass restrictions.** Positions default to all three and contraindications come only from joints the user ticks (`library/custom.ts:24-25`). Rosa (with support, fell) ran an untagged two-hand dumbbell squat in Custom; Dave's untagged quad move survives a sharp knee stop. Derive joints from the chosen main muscles (and require ≥1), default position = standing only unless the user picks, and apply with_support/two-hand rules.
- **R4-04 Teen can switch on adult-only plans by deep link.** `/program/weightLoss-fullBody-3` and `/program/seniorSteady-fullBody-2` work for a teen (`app/program/[id].tsx:23-30` never checks `plan.modes.includes(mode)`; `program/apply.ts:46-55`). Check mode on the page and in `apply`, and clear an invalid active plan.
- **R4-05 Profile-kind protection incomplete.** (a) Editing a teen's `kind` to "self" unlocks the birth date on `/onboarding/who?edit=1` (`who.tsx:52-53` trusts raw `kind`) → teen becomes adult mode. (b) Setting `activeId` to the owner id or an unknown id, or deleting the teen entry, opens owner pages without PIN (`family/ownerIdentity.ts:40-41` returns true when the profile is missing; `OwnerOnly.tsx:22`). Use `isOwnerProfile(profile, ownerId)` everywhere; unknown/missing active profile → PIN; keep `activeId` switch to owner behind the PIN. Legacy PIN migration (`parentPin.ts:147-151`) must not import a plain-storage PIN when the owner never set one.

## P1 — function

- **R4-06 "Muscles worked" never shows main muscles.** `BodyMapCanvas.tsx:175,193` (`on = !readOnly && selected…`) with `readOnly` from `exercise/[id].tsx:117`. Draw primary as filled dots, secondary as halo; map parent keys (`chest`) to their child dots.
- **R4-07 Custom exercises with Kettlebell, Bands, Machines, Cables or Bench vanish.** The create screen uses the old 9 coarse keys (`exercise/new.tsx:22,103-106`) but filters use exact items (`filters.ts:31`). Use the exact equipment list (grouped picker) and migrate existing custom exercises.
- **R4-08 Split plans never make split days.** With a PPL plan, the balance filler (`generate.ts:509` onward) fills pull/legs into Push day → FULL BODY. When a split plan is active, limit the filler to the day's groups. Future-day preview must advance through the plan (`app/day/[date].tsx:37`). Choosing a plan must rebuild today's planned workout (`app/program/[id].tsx:28`). Add equipment and muscle filters to Plans (spec A5).
- **R4-09 Equipment changes in Settings don't rebuild the planned workout** (`workout/safety.ts:12-18,93-105` ignore equipment/location; `settings/equipment.tsx:36-49`). Include equipment and active place in the rebuild key. Clear the active place chip when the list no longer matches it.
- **R4-10 "+1 rep" day resets the load to 0 lb** for 60+ and joint-care (`play.tsx:327` uses `advice.load` only when `kind==='load'`; `loads.ts:104`; `loads.ts:78`). Keep the last load on reps days. Bodyweight hint shouldn't say "same weight".

## P2

- **Lists cut off:** Library grid stops at 60 (`(tabs)/library.tsx:217`), "Not for you" at 40 (`:236`) — paginate or "Show all". Search field collapses under the body map (`TextField.tsx:47`, `flex:1`). Add search debounce.
- **60+ Progress not simple:** shows Sets, weekly-sets chart and Body tab (`(tabs)/progress.tsx:71,90,180-191`; `progress/checkin.ts:13` includes senior). 60+: workouts, hours, calendar only; Body for adults 18–59. 60+ Library area buttons miss Shoulders (`library.tsx:34`).
- **Units:** rest screen "Last session: 8 reps · 40 lb" in kg mode (`rest.tsx:62`); 17.5 kg in workout vs 18 kg on exercise page (`loads.ts:56` vs `library/performance.ts:12`) — one rounding rule; "+5 lb" hint fixed text (`rest.tsx:153`) — use the real step in the user's unit.
- **Rest labels** show 120 s while the timer runs the chosen 90 s (`workout/format.ts:48`, `play.tsx:448`).
- **Reminders vs plan days:** "My plan's days" = Mon–Fri but week strip plans Mon, Tue, Wed, Fri, Sat (`notifications/plan.ts:45` vs `program/week.ts:17`). One source of truth.
- **Streak hint "Rest day?"** shows on planned training days (`workout/streak.ts:106`, `(tabs)/home.tsx:265`) — only on non-planned days.
- **"Rest today" rule** has no time window (`generate.ts:381-383`); only consecutive sessions within 72 h; Custom sessions shouldn't count.
- **Single workout** pads with unrelated muscles and says FULL BODY (`app/workout/single.tsx:34`); train what was picked. Duplicate note with wrong reason after a sharp stop (`generate.ts:478` and `:546`). Dead bug got ramp-ups and 40 lb.
- **Short balance** includes Reverse crunch — only pattern=balance (`generate.ts:876`). Short mobility in deload week shows "DELOAD WEEK: FEWER SETS".
- **Deload** is −33% for 3-set moves (`program/block.ts:30`); ≥40% fewer weekly sets, never below 1 set.
- **Variety:** Chest-supported DB row in 11 of 24 sessions; identical sessions repeat 3 days apart; odd fillers for gym "Get stronger" (band toe pull, dead hang); pull lags push.
- **Progression doc vs code:** code needs 2 qualifying sessions; progress.md says 1. Keep 2, fix the doc.
- **Custom exercises** not marked "Not reviewed by a coach" in the list and player.
- **Share:** teens with sharing off see "Share my streak" (`milestone.tsx:155`, use `canShare`) and "Share TapStrong with friends" (`settings/index.tsx:96-100`) that go nowhere. "Share with friends" should share the invite link.
- **Badges page** shows a stale "NEW MILESTONE · 7-DAY STREAK"; numbers unformatted (`milestone.tsx:148`).
- **Exercise graph** lists only the first 8 exercises (`ActivityCard.tsx:214`); goal saves only on Enter on web (`:272`).
- **Teen copy:** "Height and weight are optional" with no fields (`onboarding/chat.tsx:62`); "Your child's birth month and year" (`who.tsx:151`, `en.json:141`); 17-year-old Family → Add mentions "parental consent". PIN setup copy promises more than it gates — gate removing a restriction and Experience behind the PIN for teens, or narrow the copy. "Inchworm lite" shown to teens as "Not for your age" — check minAgeBand.
- **i18n:** decimals not localized (hours, WHtR `BodyPanel.tsx:73`, record tiles); "Outubro De 2026" (`ActivityCard.tsx:293`); ES "ENTRENAMIENTOS" vs "ENTRENOS"; PT "0 exercício escolhido"; streak saver has two names per language; "Firme" chip; "New to training keeps to beginner moves" vs code level+1; ES titles "&" → "y".
- **Accessibility:** tab labels still clipped (`(tabs)/_layout.tsx:24-33`) — fix and add a screenshot test; Chip selected state (`Chip.tsx:17`); body-map dots pressed state; switches ≥44 px with `aria-checked` (`ToggleRow.tsx`); "Not for you" `aria-expanded`; nested button in Library cards (`library.tsx:70-88`); overlapping dot targets (Mid chest vs Lower chest).
- **Misc:** profile "Home · Bodyweight" but Equipment shows 0 items when onboarding ends without a preset — default to the matching preset. Laura's "Seated shoulder rolls" warm-up has 1 swap. `d-package` jest test flaky under load. React "component name 'o'" warning.
