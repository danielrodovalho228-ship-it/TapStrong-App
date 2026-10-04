# TapStrong — Product & Build Spec (v1.0, Sep 26 2026)

Source of truth for building the TapStrong mobile app. Visual reference: `docs/mockups/` (26 phone screens, 390×844, numbered in flow order; see its README). When this spec and the mockups disagree, this spec wins; ask the owner (Daniel) when both are unclear.

---

## 1. Product in one paragraph

TapStrong is a fitness app for ages 9 to 75+, men and women, launching in the US first. The user talks to a coach (short chat interview), taps muscles on a realistic body map, chooses a goal per muscle (Grow / Firm / Strengthen / Balance / Mobility) and gets an auto-generated workout with the app's own demo videos. After training, worked muscles turn red on the body and fade over time; untrained areas turn grey-blue and the app suggests finishing them. "Repair" mode finds and strengthens weak muscles. Tagline: **Tap. Talk. Train.**

## 2. Non-negotiables

1. **Exercise ↔ muscle accuracy.** An exercise appears to users only if `status = 'released'`. Release requires:
   - automated rule checks;
   - a second independent mapping check;
   - sign-off by a certified reviewer (name + credential stored).

   Never let the LLM invent exercises or muscle mappings at runtime. The LLM only chooses from the released library.

2. **Safety first.**
   - The health check runs before the first workout. Red flags (heart condition, pregnancy/postpartum, recent surgery) show a "check with your doctor" notice.
   - Pain reporting runs during workouts. Sharp pain means stop today's workout. Dull pain means a safe swap plus a saved restriction.
   - Restrictions filter every future workout.
3. **Kids & teens.**
   - **Launch: under 13 is OFF** (Daniel, Phase 12). Minimum age 13, with a neutral age screen: someone under 13 answering for themselves sees "TapStrong is for ages 13 and up", kept on the device so a new birth date does not unlock it. "My child" means a teen (13–17); no parental-consent flow, no child body models, no "Kids 9+". Switches: `EXPO_PUBLIC_KIDS_UNDER_13_ENABLED` in the app and `public.app_settings.kids_under_13_enabled` in the database (checked by `create_child_profile`), both false. The kids code, rules and tests stay for version 2 (after the lawyer). The under-13 rules below apply only when both switches are on.
   - Under 13: the profile must be created by a parent or guardian (COPPA — verifiable parental consent). No open-ended AI chat, no social sharing, no photos, no body measurements. The child uses guided choices only.
   - 13–17: no body-fat language, no BMI or waist index, no before/after photos.
4. **Privacy.** Before/after photos are adults only and stored **on device only** (never uploaded). In 60+ mode they are off by default and turned on from Progress (Daniel, Sep 2026). Height and weight are optional.
5. **Honest billing.**
   - Clear trial end date and a reminder before charging.
   - Cancel instructions for the App Store / Google Play are always one tap away.
   - No dark patterns.
6. **Look & feel.** Professional, not "AI-looking":
   - Fonts: Barlow Condensed (headings, uppercase) and Barlow (body).
   - No gradients, no emoji, no generic stock-UI look.
   - Touch targets ≥ 44 px. Text contrast ≥ 4.5:1.
7. **English first,** then Spanish and Portuguese (BR). All strings go through i18n from day one — no hard-coded text.

## 3. Tech stack

| Layer              | Choice                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                | Expo (latest stable SDK) + React Native + TypeScript (strict), expo-router                                                                                |
| State/data         | TanStack Query + Zustand; MMKV for local cache                                                                                                            |
| Backend            | Supabase: Auth (Apple, Google, email), Postgres with RLS on every table, Storage (exercise media), Edge Functions                                         |
| AI coach           | Claude API, called **only from a Supabase Edge Function** (key never in the app). Structured JSON output; the model picks from released exercise IDs only |
| Payments           | RevenueCat (App Store + Google Play)                                                                                                                      |
| Video              | expo-video (muted autoplay loops)                                                                                                                         |
| Body map           | Image per body model + tappable hotspot layer (react-native-svg); coordinates stored in a JSON per view                                                   |
| i18n               | i18next + expo-localization; `en` source, `es`, `pt-BR`                                                                                                   |
| Analytics / errors | PostHog (events below) + Sentry                                                                                                                           |
| Notifications      | expo-notifications (reminders, streak saver, trial reminder)                                                                                              |
| Tests              | Jest + React Native Testing Library for logic; Maestro for the main flows                                                                                 |

Ask before adding any other paid service.

## 4. Brand tokens

| Token                 | Value                                      |
| --------------------- | ------------------------------------------ |
| Background            | #F3F1ED                                    |
| Ink                   | #121212                                    |
| Muted text            | #5E6168 / #45484F                          |
| Lines                 | #DDD8D0                                    |
| Accent                | #C23E17 (hover/pressed #A3340F)            |
| Teal (trust/safety)   | #1F5F5B                                    |
| Dark screens          | #121212 with accent #E8663F / soft #EDA487 |
| Body map canvas       | #E9E5DE                                    |
| Radius                | buttons 10, cards 12, chips 6              |
| Primary button height | 54                                         |

Recovery colors (body map):

| Time since trained     | Color                        |
| ---------------------- | ---------------------------- |
| 0–24 h                 | red #C23E17                  |
| 24–48 h                | orange #E8663F               |
| 48–72 h                | peach #EDA487                |
| after 72 h             | neutral (96 h for users 60+) |
| not trained in 5+ days | grey-blue #7F93A8            |

## 5. Body model bank

Files: `C:\Users\danie\OneDrive\Daniel\Aplicativo\App Gym Flex\Imagens\body-<band>-<sex>-<view>.png` (768×1376). Copy them to `assets/bodies/`, exporting 2× WebP.

| band   | ages  | key    |
| ------ | ----- | ------ |
| kid    | 9–12  | kid    |
| teen   | 13–17 | teen   |
| young  | 18–29 | young  |
| adult  | 30–44 | adult  |
| mid    | 45–59 | mid    |
| senior | 60–74 | senior |
| elder  | 75+   | elder  |

- The sex is `m` or `f`; the view is `front` or `back` (28 images).
- The band is computed from birth month + year. The user can switch body or age model anytime, within the profile's age group: adult profiles see 18+ models only, and kid or teen profiles see kid and teen models only (Daniel, QA round 1, Sep 2026). Safety mode always comes from the birth date, never from the chosen image.
- Under 13, the body choice reads "Boy / Girl" (also for teens), and the goals "Look better", "Grow" and "Firm" are not offered (QA round 1).
- Height and weight (optional) are used only for a later "build" variant.
- **Clothing rules for any new media:**
  - men 18+: athletic shorts only;
  - women 18+: sports bra + shorts;
  - ages 9–17: t-shirt + shorts + sneakers;
  - everyone: natural hair;
  - the muscle map is drawn from the neck down only.

Muscle hotspots:

- **Front:** traps, front shoulders, upper / mid / lower chest, biceps, forearms, upper / lower abs, obliques, hips, inner thighs, quads, knees, shins.
- **Back:** traps, rear shoulders, upper back, lats, triceps, lower back, glutes, hamstrings, calves.

Store the coordinates in `src/features/bodymap/hotspots.json`. The mockup coordinates assume a 288×516 image:

- **Front:** traps 144,101 · shoulders 101,122 / 187,122 · upperChest 126,115 / 162,115 · midChest 126,131 / 162,131 · lowerChest 131,147 / 157,147 · biceps 90,162 / 198,162 · forearms 79,212 / 209,212 · upperAbs 144,174 · lowerAbs 144,203 · obliques 119,191 / 169,191 · hips 103,262 / 185,262 · adductors 144,318 · quads 124,340 / 164,340 · knees 126,383 / 162,383 · shins 124,424 / 164,424.
- **Back:** traps 144,99 · rearDelts 97,122 / 191,122 · upperBack 144,133 · lats 115,167 / 173,167 · triceps 86,153 / 203,153 · lowerBack 144,205 · glutes 126,248 / 162,248 · hamstrings 126,338 / 162,338 · calves 122,396 / 167,396.

Verify every point on every one of the 28 images; bodies differ.

## 6. Exercise media

- **Production:** a licensed professional 3D library (Gym Animations first choice, MoveKit backup). The license must allow in-app use and a commercial subscription app.
- **Prototype:** the AI demo loops in `App Gym Flex\Imagens\ex-*.mp4`. They are placeholders only and must never be marked `released`.
- **Launch (Daniel, Oct 3):** the clips made by the owner in Google Flow (`assets/prototype/<slug>.<f|m>.mp4`, both sexes, passed the frame-by-frame QC) ship in the store version, served from Supabase Storage (bucket `exercise-media`) and cached on the phone; `media_provider = 'google_flow'`. They never go in the app bundle. The licensed 3D library can replace them later.
- **Launch set:** only the launch set (`supabase/seed/launch_set.json`) is reviewed before the first release; an exercise is released after a certified sign-off and a second independent check, and only with clips for both sexes. The rest follows in updates.
- Media is served from Supabase Storage (or a CDN): 540p muted loops, a poster frame, and a thumbnail.
- **Do not bake muscle highlights into videos.** The app draws the target label and the body-map highlight itself, from the exercise's verified mapping.

## 7. Data model (Postgres)

- **`profiles`**
  - `id` (own profile id), `user_id?` (= auth user, for profiles with their own login), `display_name`, `birth_month`, `birth_year`, `sex` (m/f; null = neutral body), `body_band` (derived), `height_cm?`, `weight_kg?`, `waist_cm?`
  - `units` (imperial default in US), `locale`, `mode` (child/teen/adult/senior)
  - `guardian_id?` (child and senior profiles managed under a family plan), `created_at`
  - The signed-in user owns the account. Managed profiles (a child, a parent or grandparent) may have no login: `user_id` is null and they are linked through `guardian_id` / `family_members`. Every profile has a `user_id` or a `guardian_id`.
- **`health_screen`**: `profile_id`, `pain_areas[]`, `conditions[]`, `position` (standing / with_support / seated_only), `red_flag` bool, `answered_at`
- **`restrictions`**: `id`, `profile_id`, `area`, `side?`, `source` (pain_report / repair / manual), `note`, `active`, `created_at`
- **`preferences`**: `profile_id`, `location` (gym / home / outdoors), `minutes`, `days_per_week`, `equipment[]`, `main_goals[]` (look / lose_weight / strength / bone_health / sport / mobility / balance / fitness; under 18, `fitness` — "More fitness / energy" — replaces `lose_weight`)
- **`muscle_goals`**: `profile_id`, `muscle_key`, `goal` (grow / firm / strengthen / balance / mobility), `priority`
- **`muscles`**: `key`, `region`, `view`, `label_i18n_key`, `anatomy_i18n_key`, `movement_group` (push / pull / legs / core), `parent_key?` (upper chest → chest)
- **`exercises`**
  - `id`, `slug`, `name_i18n_key`, `equipment[]` (all required; empty = bodyweight), `location[]`, `level` (1–5), `min_age_band`, `positions[]` (position abilities it suits)
  - `contraindications[]` (areas/conditions), `cues_i18n_key`
  - `movement_pattern`, `session_parts[]` (warmup_general / warmup_mobility / main / finisher_cardio / finisher_mobility / cooldown_walk / cooldown_stretch / cooldown_breathing), `dose_type` (reps / time), `loaded`, `unilateral`, `impact` (0–2)
  - `media_video`, `media_poster`, `media_provider`, `license_ref`
  - `status` (draft / auto_checked / second_checked / released / retired), `mapping_version`
  - The database enforces the release rules: new rows start as draft; each status step needs a passing review of the **current** mapping version; `released` also needs licensed, non-prototype media; the mapping is locked unless the exercise is a draft, and any mapping change bumps `mapping_version`.
- **`exercise_muscles`**: `exercise_id`, `muscle_key`, `role` (primary / secondary / stabilizer), `emphasis` 0–1
- **`exercise_reviews`**: `exercise_id`, `check` (auto / second / certified), `reviewer_name`, `credential`, `result`, `notes`, `mapping_version`, `reviewed_at`
- **`exercise_swaps`** (Phase 4): `profile_id`, `session_id`, `item_order`, `from_exercise_id`, `to_exercise_id`, `reason` (user_choice / machine_taken / pain), `sets_done_before`, `swapped_at` — swap history, later used to learn preferences.
- **`plans`** (generated program): `id`, `profile_id`, `weeks`, `sessions_per_week`, `created_from` (json of goals)
- **`sessions`**: `id`, `profile_id`, `plan_id?`, `index`, `kind` (regular / finisher), `scheduled_for`, `status` (planned / active / done / skipped / partial), `started_at`, `ended_at` — `profile_id` on the row keeps RLS simple and allows one-off sessions (the 10-min finisher) without a plan (Phase 4).
- **`session_items`**: `session_id`, `order`, `exercise_id`, `sets`, `reps_min`, `reps_max`, `rest_s`, `load_hint`, `role` (warmup / main / finisher / mobility / cooldown); also `part`, `target_muscle`, `goal`, hold seconds, `duration_s`, `per_side` (Phase 4)
- **`set_logs`**: `session_item_id`, `exercise_id` (the exercise actually done, after swaps), `set_no`, `reps`, `seconds?`, `load`, `unit`, `rpe?`, `logged_at`
- **`muscle_activity`**: `profile_id`, `muscle_key`, `last_trained_at`, `volume_7d` (derived, feeds the body colors)
- **`streaks`**: `profile_id`, `current`, `best`, `freezes_available`, `last_active_date`
- **`pain_reports`**: `profile_id`, `session_id`, `area`, `side`, `type` (sharp / dull / tired), `action_taken`
- **`checkins`** (Phase 7): `profile_id`, `taken_at`, `strength` (json), `waist_cm`, `weight_kg`, `whtr`, `bmi`. Body fields are refused by a trigger unless the profile is adult or 60+; the app itself shows and collects them for adults 18–59 only (QA round 4).
- **`repair_results`** (Phase 7): `profile_id`, `test_key`, `value` or `left_value` + `right_value` (seconds / reps) or `pass_left` + `pass_right`, `tested_at`. The test catalog (`supabase/seed/repair_tests.json`) is a draft until the certified reviewer signs it off, like exercises: development builds only.
- **`repair_plans`** (Phase 7): `profile_id`, `weeks`, `sessions_per_week`, `focus` (json: muscle + goal), `retest_at`, `ended_at`. Repair sessions use `session_kind = 'repair'`.
- **`exercises`** also carries (Phase 9) `joint_movements` (json: joint, movement, range `full` / `partial` / `isometric`), `range_limit` (movements it can do in a shorter range) and `rehab` (recovery-plan only). Reviewed with the muscle mapping.
- **`movement_pains`** (Phase 9): `profile_id`, `area`, `side`, `painful[]`, `pain_free[]`, `score` 0–10, `duration`, `level` 1–6, `active`, `checks` (json traffic-light checks), `retests` (json weekly retests).
- Before/after photos are never stored on the server: files stay on the phone.
- **`family_members`**: `owner_id`, `member_profile_id`, `role` (child / parent / partner), `consent_record_id?`
- **`subscriptions`** (Phase 6): `user_id`, `plan` (free / premium / family), `status` (trial / active / grace / expired), `product_id`, `store`, `trial_ends_at`, `expires_at`, `will_renew`, `first_charged_at`, `last_transaction_id`. Written only by the RevenueCat webhook Edge Function.
- **`consent_records`** (Phase 6): `owner_id`, `child_profile_id`, `method` (store_transaction), `transaction_ref`, `notice_version`, `accepted_at`, `revoked_at?`
- **`referral_codes`** (`user_id`, `code`) and **`referrals`** (`code`, `invited_user_id`): written only by the `my_referral_code()` / `redeem_referral()` functions; saved accounts only, never child profiles (Phase 5). Rewards come with payments (Phase 6).
- **`badges`**: `profile_id`, `key` (first_workout / streak_7 / streak_30 / first_pr / full_body_week), `earned_at`
- **`events`** (analytics mirror, optional)

RLS: a user sees only their own rows plus family members they manage. `exercises` and `exercise_muscles` are readable when `status = 'released'`.

## 8. Core logic

### Age & mode

- Age < 13: **child** mode. It needs a guardian account. Guided choices only; no chat free text, sharing, photos or measurements.
- 13–17: **teen** mode. No index, no photos.
- 60+: **senior** mode.
  - Larger text (+2 steps), 96 h recovery.
  - Balance and fall-prevention focus.
  - Seated and supported options first.
  - The family owner can see progress.
  - Home (mockup 23): one big Start, My progress, last workout with "Read it to me" (speech). No body-map tab and no camera entry points; before/after photos only if turned on in Progress.
- Otherwise: **adult** mode.

### Workout generator (deterministic, testable)

**Input:** muscle goals, main goals, minutes, days/week, location/equipment, age band/mode, health screen, restrictions, recent `muscle_activity`, last performance.

**Filter.** Keep only exercises that are:

- `released`;
- allowed for the location and equipment;
- at or above `min_age_band` and within the user's position ability;
- free of any contraindication that hits a restriction or condition.

**Structure** (every session, always in this order):

1. **Warm-up** (mandatory; see "Warm-up & cool-down" below).
2. **Main work:** selected muscles first, weighted by priority and goal.
3. **Balance pass:** never more than 2 hard sessions in a row on the same muscle. Keep push/pull/legs roughly balanced over the week, even if the user taps only the chest. Explain this in one line.
   - A muscle trains again only after it has recovered: 48 h, or 96 h at 60+ (reviewer to confirm). When everything chosen is still recovering, offer the short mobility session, a walk or a rest day (QA round 2).
   - One exercise per parent muscle per session; sub-regions (upper, mid, lower chest) take turns across sessions. Open slots go to the group with the least work this week.
   - A chosen muscle with no safe option is named in a note, never dropped silently. Balance / fall-prevention work is never cut by the time fit.
   - Moves that load a restricted or painful joint get a light dose (12–15, no ramp-up); a painful movement is left out while its recovery plan is in phase 1. Heavy 4–8 only for loaded multi-joint lifts (not isolation, unloaded or 60+ work).
4. **Finisher** (optional): cardio for lose_weight; mobility for mobility/balance.
5. **Cool-down** (mandatory; see below).

### Warm-up & cool-down (non-negotiable)

**Warm-up** is generated for today's muscles and position ability. It has three parts:

- **General:** 2–3 min easy cardio (march, bike, brisk walk, jumping jacks for young users).
- **Dynamic mobility:** 2–3 min of moves for the joints used today (e.g. arm circles and band pull-aparts for a chest day; leg swings and hip circles for a leg day). No long static stretches before lifting.
- **Ramp-up set:** 1–2 light sets of the first loaded exercise at about 40–60% of the working load (adults with weights only).

**Cool-down** also has three parts:

- **Walk:** 2 min of slow walking or easy cycling.
- **Static stretches:** 20–30 s holds for the muscles trained today.
- **Breathing:** slow breathing for 30–60 s.

| Mode        | Warm-up                                  | Cool-down | Notes                                                |
| ----------- | ---------------------------------------- | --------- | ---------------------------------------------------- |
| Kids 9–12   | 5 min, game-like (animal walks, skips)   | 3 min     | No ramp-up with weights                              |
| Teens 13–17 | 5–6 min                                  | 4 min     | Ramp-up with light load only                         |
| Adults      | 5–8 min                                  | 4–6 min   | Ramp-up sets for loaded lifts                        |
| 60+         | 8–10 min, supported/seated options first | 5–8 min   | Balance-safe stretches (hold a chair); no fast moves |

Rules:

- Warm-up and cool-down time counts inside the minutes the user chose. "Only 15 min today" shrinks them (min 3 min warm-up, 2 min cool-down) but never removes them.
- Users can skip the cool-down, with one "Skip cool-down?" confirm. The warm-up is never locked (Daniel, Phase 32): a "Skip warm-up" link is always visible with a short tip ("Warming up protects your joints"). The generator still puts a warm-up first in every session; only the person can skip it.
- Warm-up and cool-down moves come from the same `released` exercise library, with `role` = `warmup` / `cooldown`.
- They count toward the streak. They do not turn muscles red on the body map (only main work does).

**Dosage by goal:**

| Goal       | Sets × reps                                                   | Rest    |
| ---------- | ------------------------------------------------------------- | ------- |
| grow       | 3–4 × 8–12                                                    | 60–90 s |
| firm       | 2–3 × 12–15 + finisher                                        | —       |
| strengthen | 3–5 × 4–8 (adults); 2–3 × 8–12 (kids/teens, bodyweight/light) | longer  |
| balance    | 2–3 × 20–40 s holds per side                                  | —       |
| mobility   | 2 × 30–45 s                                                   | —       |

**Time fit.** Drop the lowest-priority items until the estimated time is within the minutes chosen. "Only 15 min today" re-runs the generator with 15 minutes.

**Swap** (MVP, Daniel, Sep 27 2026). One "Swap" button on every item of the sequence — on the workout list (screen 10) and in the player (screen 11). "Machine is taken" opens the same sheet.

- The sheet shows up to **5 alternatives** for the same primary muscle, each with its demo loop; the user compares and taps "Replace".
- The choice replaces the exercise **in the same position**; it never adds an exercise. The workout then continues in its normal order.
- Any item can be swapped. Warm-up and cool-down moves swap only with moves of the same kind (same session part).
- Alternatives:
  - same primary muscle and same role in the session;
  - `released` only;
  - the same safety filters as the generator: equipment and location, age band, restrictions, health conditions, position (standing / with support / seated);
  - never an exercise already in the workout;
  - "machine is taken" also drops options that use the same machine.
- Order (deterministic): emphasis on the same muscle, then same movement pattern, then closest level; ties by slug.
- Sets are kept; reps are recomputed from the goal rule for the new exercise. If sets are already logged, the swap applies only to the remaining sets.
- Fewer than 5 options → show what exists. None → "No safe alternative for this muscle with your equipment."
- "Undo" for 5 seconds after a swap.
- Log `exercise_swapped` with the reason `user_choice` or `machine_taken`, and save the swap history (`exercise_swaps`).
- Implementation: `getAlternatives(item, context, limit = 5)` and `swapItem` in the generator, unit-tested (never violates a restriction, never repeats an exercise in the workout, keeps the primary muscle).
- Later, not MVP (in order): a reason tag per option ("no equipment", "easier", "spares the shoulder", "same machine free"); quick filters (at home / easier / harder / no impact); favorite and "don't show again", used by the generator; saved progress per exercise (suggest last load); "5 more options".

**Progression:**

- All reps at the top of the range in the last 2 sessions → suggest +2.5–5 lb (or +reps for bodyweight).
- Failed 2 sessions → hold or reduce.

**The AI's role:**

- The Claude edge function turns the chat interview into structured inputs (`goals`, `minutes`, `days`, `location`, etc.).
- It writes the short, friendly explanations.
- It **never** picks exercises outside the generator output.

### Body colors & streak

- When a session item is logged, update `last_trained_at` for its primary muscles (full intensity) and its secondary muscles (shown as "also worked").
- The color comes from the time since training (table in §4). Muscles untrained for 5+ days show grey-blue, and the Done screen suggests a short finisher for them.
- **Streak:**
  - An active day is any logged workout or mobility session. The short mobility session (~10 min: warm-up, 3 mobility moves, cool-down) can be started from Home any time; on the free plan it is unlimited and never counts toward the 3 workouts a week, so the 7-day milestone is reachable (Daniel, decision 1, QA round 2).
  - 1 rest day per calendar week does not break it.
  - At 7 days the user earns 1 streak freeze (max 2 banked).

### Movement that hurts (Phase 9)

Physical therapists map the **movement**, not only the place ("which movement hurts?"). TapStrong never diagnoses; it plans around the movements that hurt, in any joint.

- **Catalog** (`supabase/seed/joint_movements.json`, draft until the reviewer signs it off; development builds only): movements per joint with everyday examples in EN/ES/PT-BR. Shoulder: raise in front, raise to the side, reach behind the back, turn out, turn in, overhead, push, pull, carry. Also elbow, wrist, neck, lower back, hip, knee, ankle.
- **Report:** area and side → red-flag screening → each movement rated "Hurts" / "No pain" / "Not tried" → worst pain 0–10 → how long. Children only with a parent or guardian present.
- **Red flags** (fall or blow, strong night pain, tingling or numbness, weakness, swelling/redness/heat, fever): any one → "see a doctor first", no plan, and the whole area is left out of workouts.
- **Generator** (for an area with a report, instead of the whole-area restriction), in this order:
  1. leaves out exercises that need a painful movement (movements not tried count as painful);
  2. keeps exercises that only use pain-free movements;
  3. uses a shorter range when the exercise allows it for that movement (`range_limit`), shown as "Shorter range: stop before it hurts".
  A hold without moving (isometric) in the painful direction is allowed while pain is 5 or less. Pain 7+ leaves every movement of the joint out. Recovery-only exercises never appear in regular workouts.
- **Recovery plan** (inside Repair; 15-min sessions, always with warm-up and cool-down): phase 1 gentle holds and pain-free range; phase 2 strengthening in pain-free range (shoulder: rotator cuff and shoulder-blade muscles; `rotatorCuff` is a muscle with no body-map hotspot); phase 3 shorter range of the painful movements allowed and more sets. The library has ≥ 3 draft moves per joint movement in each phase (decision 2, QA round 2); phase-1 sessions have 4 holds and never a move contraindicated for the area.
- **Traffic light** after each workout and the next morning (local notification at 8:30): 0–3 green (one step up), 4–5 yellow (hold), red (one step back) when over 5 right after, or the next morning over 5 or 2+ points above the previous score. Six steps: phase 1 = steps 1–2, phase 2 = 3–4, phase 3 = 5–6.
- **Weekly retest** of the painful movements, charted in Progress. Worse than at the start, or no better after 3 weeks → recommend a physical therapist.
- **Rules:** never diagnose; pain data never goes to analytics; everything stays draft until the certified reviewer approves the catalog and the tags.

### Measurements

- Adults only.
- Waist-to-height (WHtR) is the primary index; show BMI as secondary with its limits explained.
- **Month closed (Phase 26, `docs/phase-26-monthly-cycle.md`):** at the end of each block (4 weeks without a plan = 1 month; plans keep 5–6) a full-screen summary once, then a Home card for 7 days, ending with "Your next month" (keep progressing / repeat the same / choose on the body; no answer = the recommendation, with 7-day undo). It replaces the automatic 4-week check-in prompt; the check-in screen stays as the measurements entry. Past months: Progress > Months.
- Check-in (measurements, opened from the month summary or Progress). It shows:
  - strength changes (load × reps, push-ups, plank);
  - body changes if entered;
  - a coach note.

### Paywall & account

- The first workout is free with no account. Prompt to save progress after it (Apple / Google / email / "Not now").
- **Free plan:** 3 workouts per week (the short mobility session is unlimited, see "Body colors & streak").
- **Premium:** $9.99/mo. **Family:** $14.99/mo.
  - 7-day trial on both, with a reminder 3 days before charging (Daniel, Sep 2026; matches mockups 19 and 22).
  - Family: up to 5 profiles, the owner included. Annual: Premium $59.99/yr, Family $89.99/yr (Daniel, Sep 2026).
  - Accounts come before purchases, so a subscription always belongs to a saved account (RevenueCat app user id = Supabase user id).
  - Children under 13 (COPPA): the verifiable-consent method is the charged Family subscription (a store transaction) plus the parent notice accepted in the app. A free trial does not count; child profiles open after the first charge. The database only creates child profiles through `create_child_profile()`. Lawyer review before launch (§13).
  - Only an adult owner (18+, from their own profile) can manage family profiles or give parental consent; checked in the app and the database (`is_adult_owner`, QA round 2).
  - Parent gate: a 4-digit parent PIN set by the owner on their own profile (created when a child or teen is added, changed in Settings), 15-minute lockout after 5 wrong tries. A child profile can never create one. It guards owner controls (plans, paywall, billing, add/remove member, consent, account, delete account, profile switching, a child's birth date).
  - A consented under-13 profile can't be re-aged to 13+; a teen profile stays 13–17. "Remove member" (parent gate) frees a family slot and deletes that member's data.
  - Referral reward: 1 free week of Premium for both people, granted only after the invited person completes a first workout. The invited person gets it once; the inviter gets 1 week per friend who trains, up to 4 weeks a year (Daniel, Sep 2026).
  - Delete account in the app (App Store rule): deletes the account and all its data; the screen explains the store subscription is cancelled separately, in the store.
- When the free limit is reached, show the paywall screen (value first, price second, cancel info visible).

## 9. Screens (expo-router)

| Route                       | Mockup              | Notes                                                                                                                    |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/welcome`                  | 1 Welcome           | EN/ES/PT-BR switch, "Get started"                                                                                        |
| `/onboarding/who`           | 1b Age gate         | Me / My child / My parent + birth month/year → mode routing                                                              |
| `/onboarding/chat`          | 2 Coach interview   | Steps with progress; quick-reply chips + free text (not for children); height/weight optional with Skip                  |
| `/onboarding/safety`        | 2b Safety check     | Pain, conditions, position; red-flag notice                                                                              |
| `/onboarding/profile`       | 3 Profile summary   | Editable summary                                                                                                         |
| `/(tabs)/home`              | 4a / 4b             | First-week and ongoing states; next session, streak, body preview                                                        |
| `/(tabs)/body`              | 5 Body map          | Male/Female, age model, front/back, hotspots, goal chips                                                                 |
| `/goals`                    | 6 Goals             | Per-muscle goal + quantities (exercises, sets, days)                                                                     |
| `/workout/[id]`             | 7 Generated workout | Warm-up row, exercise list, cool-down row, "Swap" on every item (sheet with up to 5 alternatives, demo loops, "Replace", 5 s "Undo"; §8), "Only 15 min", "Machine is taken" (same sheet), reviewed-by-coach badge |
| `/workout/[id]/play`        | 8 Player            | Plays warm-up → exercises → cool-down in order; video loop, target label, set logger (± reps, load), "Swap" (same sheet as screen 7; remaining sets only), voice logging later |
| `/workout/[id]/rest`        | 8a Rest             | Timer, +30 s, skip, last-time comparison                                                                                 |
| `/workout/[id]/pain`        | 13 Pain swap        | Area, side, type → stop or swap + save restriction                                                                       |
| `/workout/[id]/exit`        | 8e End workout?     | Keep going / Save & end / Discard                                                                                        |
| `/workout/[id]/done`        | 8b Done             | Body turns red, stats, finisher suggestion, share / save                                                                 |
| `/share`                    | 8c Share card       | Muscle-map card, streak, referral link (hidden for child mode)                                                           |
| `/account`                  | 8d Save progress    | Sign-up after value                                                                                                      |
| `/(tabs)/coach`             | **NEW**             | Ongoing coach chat (questions, adjust plan). Not the onboarding chat                                                     |
| `/repair`                   | 9 Repair            | Test list, results, weak areas                                                                                           |
| `/repair/test/[key]`        | **NEW**             | Guided test player (timer, left/right)                                                                                   |
| `/repair/plan`              | **NEW**             | Corrective plan built from results                                                                                       |
| `/(tabs)/progress`          | 10 Progress         | Streak, workouts, sets, weekly chart, measurements                                                                       |
| `/checkin`                  | 10b Check-in        | 4-week results, WHtR/BMI (adults)                                                                                        |
| `/month`, `/months`         | Month closed        | Block summary + next month (Phase 26); past months                                                                       |
| `/before-after`             | 10c Photos          | Adults only, on-device                                                                                                   |
| `/milestone`                | 11b Celebration     | Streak, badges, freeze                                                                                                   |
| `/(tabs)/family` / `/plans` | 11 Plans & family   | Plans, family members, add child (guardian consent flow)                                                                 |
| `/paywall`                  | **NEW**             | Free-limit reached                                                                                                       |
| `/billing`                  | 14 Honest billing   | Trial end, cancel steps                                                                                                  |
| `/restrictions`             | 12 Restrictions     | List and manage                                                                                                          |
| `/settings`                 | **NEW**             | Account, plan and billing, restrictions, Delete account (linked from Family and Progress; QA round 1)                    |
| `/r/[code]`                 | **NEW**             | Referral landing: confirms the invite, keeps the code until the account is saved                                         |
| `/movement-pain` (+ `/[id]`, `/check`, `/retest`) | **NEW** (Phase 9) | Movement that hurts: report, recovery plan, traffic-light check, weekly retest (§8) |
| `/senior` (mode)            | 15 60+ home         | Larger UI; links stay inside senior screens                                                                              |

## 10. Analytics events

- **Onboarding:** `onboarding_started`, `age_mode_set`, `chat_completed`, `safety_red_flag`, `bodymap_muscle_tapped`, `workout_generated`
- **Workout:**
  - `workout_started`, `set_logged`, `exercise_swapped` (reason), `pain_reported` (type)
  - `workout_completed` / `workout_ended_early`
- **Growth:** `share_card_shared` (target), `account_created` (method), `paywall_viewed`, `trial_started`, `subscription_started`, `subscription_cancelled`
- **Retention:** `streak_milestone`, `checkin_completed`, `repair_test_completed`, `month_closed`, `month_chosen`, `month_skipped`, `month_undone`

Never send health details, pain data or photos to analytics.

## 11. Remaining product items (build them, no mockup needed)

1. Main goals beyond looks: lose weight, bone health, sport performance.
2. Warm-up **and** cool-down in every session (§8), plus weekly push/pull/legs balance.
3. Progression data and suggestions (§8).
4. A separate Coach tab chat (the onboarding chat is only for setup).
5. Repair test player and Repair plan screens.
6. Paywall-at-limit screen.
7. Child profile creation by a parent (COPPA consent), and a grandparent/parent profile managed by an adult child (senior).
8. A neutral body option (no sex selected) for users who prefer it.
9. Contrast and minimum text size pass (≥ 13 px captions; ≥ 4.5:1).
10. Senior-mode navigation never lands on adult screens.
11. Real translations: professional review of ES and PT-BR before launch (machine translation only for dev).

## 12. Build phases (each ends with a working build + tests + a short report)

- **Phase 0 — Setup**
  - Repo, Expo app, TypeScript strict, lint/format, env handling (`.env`, never commit secrets).
  - Supabase project + migrations, i18n scaffold, design tokens, base components (Button, Chip, Card, Header, IconButton).
- **Phase 1 — Onboarding**
  - Welcome, Age gate + modes, Chat (edge function with Claude, structured output), Safety check, Profile summary. Local-first; no account yet.
- **Phase 2 — Body map + goals**
  - Body bank, band selection, hotspots front/back, goal chips, quantities.
- **Phase 3 — Exercise library + generator**
  - Schema, review workflow, seed of ~40 prototype exercises (status `draft`, visible only in dev builds).
  - Deterministic generator with unit tests (safety filters, time fit, balance, swaps).
- **Phase 4 — Workout flow**
  - Workout list, Player, Rest, set logging, Pain swap, Exit, Done (body turns red), `muscle_activity`, streaks.
- **Phase 5 — Account & growth**
  - Save progress (Supabase Auth), Share card image, referral links, Milestone, notifications.
- **Phase 6 — Payments**
  - RevenueCat, Plans, Paywall, Billing, trial reminder, Family plan + child consent flow + senior profiles.
- **Phase 7 — Progress & Repair**
  - Progress, Check-in, Before/After (on-device), Repair tests + plan, Restrictions.
  - Family dashboard for the Family plan owner: each member's workouts, minutes, last workout and streak this week. Never health answers, pain reports or photos.
- **Phase 9 — Movement that hurts** (before launch; Daniel, Sep 2026)
  - Movement catalog, pain report, red-flag screening, movement tags on every exercise and Repair test, generator rules, recovery plan in Repair, traffic light with a morning check, weekly retest with a chart. See §8.
- **Phase 8 — Polish & launch prep**
  - Senior mode pass, accessibility, ES/PT-BR, Maestro E2E, Sentry/PostHog, app icons/splash.
  - Store listings, privacy labels, TestFlight / internal testing.
  - Also: body-map pinch zoom (with +/− buttons), sync of check-ins and Repair (measurements adults only, photos never), custom SMTP guide (Resend). Analytics sends nothing from a child profile; crash reports carry no personal data. Store texts: `docs/store/`; launch checklist: `docs/launch-readiness.md`.

## 13. Before public launch (owner tasks, not code)

- USPTO trademark search/filing for "TapStrong"; domain `tapstrong.app`.
- License for the professional exercise library.
- Certified reviewer (e.g. NSCA-CSCS or ACSM) to sign off every exercise.
- Lawyer review: COPPA flow, privacy policy, terms, health disclaimers.
- Apple/Google developer accounts; Supabase and RevenueCat production projects.
