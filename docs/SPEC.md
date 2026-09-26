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
   - Under 13: the profile must be created by a parent or guardian (COPPA — verifiable parental consent). No open-ended AI chat, no social sharing, no photos, no body measurements. The child uses guided choices only.
   - 13–17: no body-fat language, no BMI or waist index, no before/after photos.
4. **Privacy.** Before/after photos are adults only and stored **on device only** (never uploaded). Height and weight are optional.
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
- The band is computed from birth month + year. The user can switch body or age model anytime.
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
- **`checkins`**: `profile_id`, `week`, `strength_json`, `waist_cm`, `weight_kg`, `whtr`, `bmi`, `note`
- **`repair_tests`**: `profile_id`, `test_key`, `left_value`, `right_value`, `unit`, `result`, `tested_at`
- **`family_members`**: `owner_id`, `member_profile_id`, `role` (child / parent / partner), `consent_record_id?`
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
- Users can skip the cool-down, with one "Skip cool-down?" confirm. The warm-up can be shortened, not skipped, when the day has loaded exercises.
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
  - An active day is any logged workout or mobility session.
  - 1 rest day per calendar week does not break it.
  - At 7 days the user earns 1 streak freeze (max 2 banked).

### Measurements

- Adults only.
- Waist-to-height (WHtR) is the primary index; show BMI as secondary with its limits explained.
- Check-in every 4 weeks. It shows:
  - strength changes (load × reps, push-ups, plank);
  - body changes if entered;
  - a coach note.

### Paywall & account

- The first workout is free with no account. Prompt to save progress after it (Apple / Google / email / "Not now").
- **Free plan:** 3 workouts per week.
- **Premium:** $9.99/mo. **Family:** $14.99/mo.
  - 7-day trial on both, with a reminder 2 days before charging.
  - Family profile limit [CONFIRM], annual prices [CONFIRM].
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
| `/before-after`             | 10c Photos          | Adults only, on-device                                                                                                   |
| `/milestone`                | 11b Celebration     | Streak, badges, freeze                                                                                                   |
| `/(tabs)/family` / `/plans` | 11 Plans & family   | Plans, family members, add child (guardian consent flow)                                                                 |
| `/paywall`                  | **NEW**             | Free-limit reached                                                                                                       |
| `/billing`                  | 14 Honest billing   | Trial end, cancel steps                                                                                                  |
| `/restrictions`             | 12 Restrictions     | List and manage                                                                                                          |
| `/senior` (mode)            | 15 60+ home         | Larger UI; links stay inside senior screens                                                                              |

## 10. Analytics events

- **Onboarding:** `onboarding_started`, `age_mode_set`, `chat_completed`, `safety_red_flag`, `bodymap_muscle_tapped`, `workout_generated`
- **Workout:**
  - `workout_started`, `set_logged`, `exercise_swapped` (reason), `pain_reported` (type)
  - `workout_completed` / `workout_ended_early`
- **Growth:** `share_card_shared` (target), `account_created` (method), `paywall_viewed`, `trial_started`, `subscription_started`, `subscription_cancelled`
- **Retention:** `streak_milestone`, `checkin_completed`, `repair_test_completed`

Never send health details or photos to analytics.

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
- **Phase 8 — Polish & launch prep**
  - Senior mode pass, accessibility, ES/PT-BR, Maestro E2E, Sentry/PostHog, app icons/splash.
  - Store listings, privacy labels, TestFlight / internal testing.

## 13. Before public launch (owner tasks, not code)

- USPTO trademark search/filing for "TapStrong"; domain `tapstrong.app`.
- License for the professional exercise library.
- Certified reviewer (e.g. NSCA-CSCS or ACSM) to sign off every exercise.
- Lawyer review: COPPA flow, privacy policy, terms, health disclaimers.
- Apple/Google developer accounts; Supabase and RevenueCat production projects.
