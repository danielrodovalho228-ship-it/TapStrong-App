# TapStrong — QA round 1 (20 personas, web dev build of commit 9755fe0)

Date: 2026-09-27. Four testers ran 20 personas end to end, using Playwright at 390×844, with supabase.co blocked.

Not app bugs (test environment): deep links return 404 on the static server; AI, email and sync fail offline; durations were inflated by the clock fast-forward.

Owner requests (Daniel) are included in section 0 and have the same priority as P0.

---

## 0. Owner requests (must do)

**O-1. Recovery map uses the body-map dot style.**

- The Home recovery map (and the Done and Share body) must use the same small hotspot dots as `/body`, not blurred blobs.
- Each muscle point is a small dot filled with its recovery colour: red, orange, peach, neutral or grey-blue.
- Show a front and back toggle, or both views, so back muscles (glutes, lats, hamstrings) are visible.
- One shared `RecoveryBody` component uses `hotspots.json`.

**O-2. Every item has a demo.** Warm-up and cool-down items get the same thumbnail and demo player as main exercises:

- a thumbnail in the list row;
- a demo in the player;
- the same media pipeline (licensed library later; the prototype slot for now).

No item may render as text-only.

**O-3. Far more variety.** The library is too thin. Today:

- the swap often shows 0 or 1 option (arm circles: none; brisk walk: only jumping jacks; upper chest in a full gym: none);
- there are no lateral raises.

Expand the draft library so that every combination has **at least 5 safe alternatives**:

- each primary muscle × role (main, warm-up, cool-down, mobility, finisher);
- each equipment level (none, bands, dumbbells, gym);
- each position (standing, supported, seated).

Also add:

- **Warm-up:** ≥ 10 per body region (upper, lower, full body, seated), matched to today's muscles.
- **Cool-down:** ≥ 3 static stretches per muscle group, matched to the muscles trained today.
- **Repair / pain correction:** for every joint movement in the 41-movement catalog, ≥ 3 isometric (phase 1), ≥ 3 pain-free-range strengthening (phase 2) and ≥ 3 progressive-loading (phase 3) moves. The shoulder set includes the rotator cuff.
- **Balance and fall-prevention:** ≥ 10, including seated and supported ones.
- **Kids:** game-like warm-ups.

Rules for the new moves:

- all new moves are `draft` with `joint_movements`, contraindications and 3-language names and cues;
- the reviewer spreadsheet is regenerated;
- target roughly 250 or more exercises.

Add a coverage test that fails when any muscle × role × equipment cell has fewer than 5 options (or documents why).

---

## 1. P0 — safety and child-safety (fix first)

| ID          | Problem                                                                                                                                                                                         | Fix                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01        | A COPPA child profile can be re-aged to teen or adult on the age screen (right after consent and via "Edit: Born"). This unlocks free-text AI, share, photos and measurements.                  | Lock the birth date and mode for `kind: child`; only the parent, behind a parent gate, can change them.                                                                     |
| B-02        | "Fat-loss finisher" is shown to teens, and to kids when a finisher fits.                                                                                                                        | Mode-aware label ("Cardio finisher"); no body-fat words under 18.                                                                                                           |
| C-01        | After a SHARP pain stop, Done says "First one done!" and offers "Add 10 min", which starts a new workout the same day.                                                                          | After a sharp stop: no finisher, no new workout that day for that area, with calm copy.                                                                                     |
| C-02 / A-02 | After a red flag, "the area is left out", but workouts still load it (cat-cow, glute bridge; arm circles, floor press, rows). The filter reads only `contraindications`, not `joint_movements`. | A red flag excludes every exercise whose `joint_movements` touch that joint. The restriction shows as "Doctor first", with no one-tap "Mark healed" (ask for confirmation). |
| A-01        | Home "Start" opens the stale workout generated before a pain report or restriction. It still contains Dumbbell shoulder press, and the player starts it.                                        | Invalidate and regenerate planned sessions whenever restrictions, movement reports or health data change.                                                                   |
| C-03        | 60+ seated, home, bodyweight user gets no workout, and the misleading "library is being reviewed" message (every generator error is mapped to `unavailable`).                                   | Library coverage (O-3), plus honest error states with a way forward.                                                                                                        |

## 2. P1 — logic and major UX

**Senior / 60+**

- **B-07/C-05:** after onboarding, seniors land on `/body` (`profile.tsx:77`), and "Manage plan" opens adult Billing. Seniors must land on the senior home, and senior navigation must never reach adult-only screens.
- **B-08/C-06:** the Balance goal gets "3 × 8–12 each side" strength sets. Balance needs 20–40 s holds, and seniors, especially after a fall, get balance or fall-prevention work.
- **C-07:** seated Joe picked Quads and Glutes but got shoulders only; the card still says "QUADS & GLUTES". Use seated leg options, or explain the change.
- **C-08:** "With support" users get no "hold a chair" cue.
- **C-09:** heart condition or high blood pressure gets heavy 3×4–8 plus ramp-up sets. Use moderate reps, a "breathe, don't strain" cue and a doctor reminder. Reviewer to confirm.

**Family and children**

- **B-03:** child and teen profiles have owner controls: switch to the parent profile, billing, delete account, add member, tick the consent box, and see the parent email. Add a parent gate (PIN or re-auth) for all of these.
- **B-06:** the consent screen trusts its URL params, and a failed `add()` still switches to a ghost profile. Re-check plan, charge, limit and age < 13, and never switch on failure.
- **B-05:** "My child" under 13 is a dead end with stale copy ("later update"). Add a button that guides the parent to create their own profile, then add the child in Family.
- **B-04:** the web Select picker hides options above the current value (months, "Age 18–29").

**Movement that hurts**

- **A-03:** the recovery session is 11 min with Band front raise 3×4–8. Phase 1 must be isometric holds and pain-free range, about 15 min.
- **A-04:** the morning check has no in-app entry (notification only). A green rating doesn't advance the plan. Compare the morning rating with the previous rating, not the initial one.
- **A-05:** the dull-pain "safe swap" suggests a shoulder-contraindicated push-up, and the player says "heavy load" for bodyweight.
- **C-04:** after a dull lower-back swap, the same session still plays a lower-back-unsafe RDL. Re-filter the rest of the session.
- **C-10:** a hidden `pregnant_postpartum` flag stays when the body is switched to Man.

**Generator and home**

- **D-01/A-08:** the Home "Today" card names the wrong muscles, suggests the muscle trained minutes ago and ignores recovery. The card must match the generated session and prefer recovered or untrained areas.
- **D-03:** chest sub-regions are checked separately, so chest was trained 5 days in a row. Count parent muscles for the "max 2 in a row" rule, and keep the week push/pull/legs balanced.
- **D-04:** the goal muscle Abs was never programmed in 9 workouts. Rotate all selected muscles through the week.
- **D-02:** the "Sets each" stepper is ignored.
- **A-07:** the promised cardio finisher for lose weight / look better never appears. Honour it, or change the copy.
- **A-11:** "Swap · same muscle" offers other body parts (arm circles → hip circles). Warm-up and cool-down swaps must stay in the same region.
- **A-06:** Done and Home show the front only, so back muscles never turn red (fixed by O-1).

**Other P1s**

- **A-09:** Spanish "Molestia / pinchazo" reads as sharp pain. Use "Molestia sorda / incomodidad".
- **A-10/D-36:** the Family tab causes a setState-during-render error, and the dev toast blocks the tabs.
- **D-05:** body-map hotspots only respond in 22 px; the near-miss fallback doesn't fire on web. Make targets 44 px.

## 3. P2 — polish (batch)

**Copy**

- Plurals: "1 light ramp-up sets", "1 minutes".
- "Good morning, TODAY".
- "Last workout: Monday" on the same Monday.
- "seated options" shown to "with support" users.
- The "Added push/legs…" note stays after the work was cut.
- The swap-sheet "none" message blames the user's equipment.
- "Save your account to get your own invite link" shown to saved users.
- "FIRST WORKOUT · DONE" shown after workout 2.
- A failed free-text reply blames the user ("didn't get that") instead of the network.

**Timers and dosing**

- List vs player time mismatch (3 min vs 2:42; 1 min vs 1:18).
- Warm-up "Done" is locked until half time, with no hint.
- Warm-up header minutes ≠ sum of its items.
- "each side" shown on two-arm moves.
- Knee-safe substitutes dosed like heavy strength.
- No ramp-up when the first main move is bodyweight and a loaded lift follows.
- After a player swap, the old load stays (10 lb).

**Recovery legend**

- "today" and "1 day ago" are off by one band.
- Never-trained muscles show as "5+ days" right after workout 1.
- Freeze count never shown.
- A streak rest day can be reused after a break.

**Features**

- "Only 15 min" loses swaps and has no way back.
- Cool-down doesn't match the muscles trained.
- No "I feel pain" or Swap on timed warm-up/cool-down steps.
- Check-in compares with itself ("was 0.46"), and re-saving drops the weight.
- "Share my 4 weeks" opens the daily card.
- The share card lists the wrong muscles (catalog order, not targets).
- Plans preselects Family, and a subscriber has no upgrade/downgrade path.
- After buying, the user lands on Billing instead of resuming the workout.
- No trial-end date on the paywall.
- Free plan (3/week) can never reach the 7-day streak milestone. Decide whether free mobility days count.
- Delete account is hard to find (add Settings).
- Referral landing shows no confirmation.
- Web share and photo have no fallback.

**Accessibility and layout**

- Body-map captions overlap.
- Zoom has no pan on web.
- Focus lands on `aria-hidden` elements.
- "Edit" links are 30 px wide and not buttons.
- Chip remove buttons are 40 px.
- Tab labels clipped.
- Movement toggles have duplicate accessible names.

**PT/ES translation**

- "DEMO · LOOP" untranslated.
- Exercise names left in English: Leg press, Dead bug, Superman, Bird dog.
- Gender slips: "Nenhum" → "Nenhuma", "Adulto" for women, "pai, mãe ou avô" missing "avó".

**Content**

- Kids see "Look better / Grow / Firm" and "Man / Woman". Minors can pick adult body models (owner decision: restrict minors to kid/teen models).
- Pregnancy option shown to an 80-year-old.
- Profile summary omits conditions and position.
- "Softer look is body fat" callout shown to every "look better" user.

---

## What passed

- Safety notices and gates (heart, surgery, pregnancy) in 3 languages.
- Warm-up first and cool-down last, including 15 min.
- Swap mechanics: ≤ 5 options, in place, Undo, machine taken, remaining sets.
- Sharp and dull pain paths.
- Paywall on the 4th workout with correct prices and terms.
- Billing and cancel.
- Streak, rest day, freeze and milestone.
- Recovery colours (72 h adults, 96 h 60+).
- Check-in: WHtR first, BMI second, adults only.
- Share-card privacy.
- Family isolation and a dashboard with activity only.
- 5-profile limit.
- Child and teen restrictions: no text chat, share, photos or measurements for kids; no BMI or photos for teens; light loads.
- Senior home: big text and "Read it to me".
- Knee filtering.
- Fresh workouts after a movement report keep the pain-free presses and drop the painful moves.
