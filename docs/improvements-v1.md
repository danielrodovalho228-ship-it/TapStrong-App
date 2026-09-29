# TapStrong — improvements v1 (reference: Gymverse, reviewed by Daniel)

Phase 14 instructions (Daniel): implement packages A, B, C and D in this order, one commit per package, with tests, i18n en/es/pt-BR and a report in Portuguese at the end. Before coding, map each new screen to an existing mockup or propose the layout in text and follow it. Only after Phase 13 is approved (approved).

---

Keep TapStrong's essence. Non-negotiables:

- The tap body map with small dots is the heart of the app: goals, recovery, library, and "muscles worked" all use the same `BodyMapCanvas` dots.
- The coach interview, Repair, Movement that hurts, age modes (teen 13–17, adult, 60+), safety filters and released-only exercises stay exactly as they are.
- Swap sheet keeps Daniel's rule: up to 5 recommended alternatives, replace only.
- Every new screen works in teen, adult and 60+ modes. 60+ gets the simpler version (big text, fewer numbers). Teens get no calorie, body-fat, measurement or leaderboard content.
- Light TapStrong design (our tokens), not Gymverse's dark bodybuilder look. No global leaderboards (privacy).

## A · Today's workout + plans

1. **Week strip** at the top of Home and the workout list: Sun–Sat, today highlighted, a dot on trained days, a hollow dot on planned days. Tap a day to see that day's session (past = log, future = preview).
2. **Program block label:** "Week 3 of 5 · Build" (4–6 week blocks; last week lighter = "Deload"). Day name from the session: Push / Pull / Legs / Full body / Upper / Lower / Mobility / Repair.
3. **Session summary line:** "6 exercises · 45 min". Adults may also see an estimated kcal (from Apple Health / Health Connect weight if synced); never for teens.
4. **Suggested load per exercise:** "3 × 10–12 · 25 lb". First time: ask "pick a weight you could lift 2 more times" and log it. Then progression: if every set hit the top of the rep range with RPE ≤ 8, suggest +5 lb upper / +10 lb lower (or +1 rep for bodyweight/bands); if reps were missed twice, keep or lower. Joint-care and 60+ progress more slowly (+1 rep before any load). Deload week −40% volume. All deterministic and unit-tested.
5. **Ready-made plans (Library → Plans):** cards by days per week (2–6), goal (get in shape, build muscle, get stronger, lose weight, mobility & balance, 60+ strong & steady) and split (full body, upper/lower, push/pull/legs). Filters: equipment, muscles, duration. Choosing a plan sets the generator's split and targets; the generator still picks the exercises (safety filters apply). "My plan" (auto, from the coach) stays the default.
6. **Workout modes:** My plan / Single workout (pick muscles on the body map now, one session) / Custom (user builds a list from the Library, still filtered for safety).
7. **Share today's workout** (not for teens under a Family plan without the parent setting on; the existing share-card privacy rules apply).

## B · Exercise library (new tab "Library" or "Exercises")

1. **Browse by body:** the same body map with dots, front/back toggle and a 180° swipe to turn it. Tap a dot → grid of exercises whose primary muscle is that muscle. Search bar. Filters: equipment, position (standing / supported / seated), role (main, warm-up, stretch, balance, Repair).
2. **Grid card:** thumbnail (prototype slot until the licensed 3D library), name, favourite star. Only exercises that are safe for this profile are shown by default; "Not for you right now" section collapsed with the reason (restriction, age, pain), no start button.
3. **Exercise page** with two tabs:
   - **Guidance:** demo player, step-by-step cues, common mistakes, "Muscles worked": primary (solid) and secondary (outlined) highlighted as dots on the front and back body, same dot style as the body map.
   - **Performance:** personal records (heaviest weight, estimated 1RM using Epley, best set volume), a history chart over time, the list of past sessions, and a private note field.
4. **Favourites:** starred exercises are preferred by the generator and swap sheet when safe.
5. **Create exercise** (adults only): name, primary/secondary muscles picked on the body map, equipment. Custom exercises are never auto-programmed. They only appear in Custom workouts, get the same pain/restriction check by the muscles and joints the user tags, and show "Not reviewed by a coach".

## C · Detailed equipment

1. Replace the 4 equipment levels with an **equipment list of about 60 items** grouped as benches/bars/racks, free weights (dumbbells, kettlebells, barbell, EZ bar, trap bar), cables, machines (chest, back, legs, arms, shoulders, abs), bands and accessories (mini bands, long bands, pull-up bar, TRX, ab wheel, step, chair, wall, mat, foam roller), cardio (treadmill, bike, rower, elliptical). Each has an icon and a toggle.
2. **Presets:** Full gym / Small gym / Home gym / Bodyweight only / Hotel. Several saved profiles, e.g. "Gym" and "Home", switchable from the workout header.
3. Seed: add `equipment: string[]` to every exercise (map existing levels). The generator, swap sheet and library filter by the exact list. The swap sheet may mark "Missing equipment" items as disabled and never offer them as a swap.
4. Coach interview and onboarding ask the preset; the detailed list is optional under Settings → Equipment.
5. Coverage test: every preset still gives ≥5 main options per muscle × position cell (or a documented exemption).

## D · Progress and settings

1. **Progress → Activity:** ranges 7D / 30D / 6M / 12M / All; totals: workouts, hours, total volume (lb/kg), mobility sessions counted separately; month calendar with trained days; **Exercise graphs:** pick an exercise, set a goal ("110 lb"), see current max vs goal.
2. **Badges** (no global leaderboards): streak weeks (4, 12, 26, 52), total volume milestones, first Repair phase completed, "Balance 30 days", 100 workouts. Teens: streak/consistency badges only, no volume or body badges.
3. **Progress → Body** (adults only; existing rules): weight trend, WHtR first, optional tape measurements (waist, chest, hips, arm, thigh, calf), before/after (exists). Hidden for teens.
4. **Settings:** units lb/kg; rest timer default (per role: strength 60–120 s, holds 30 s, 60+ presets); sounds and voice cues; workout reminders by day/time; motivational notifications on/off; warm-up and cool-down length (can shorten, never remove); demo model choice (male/female, age band within the user's mode); experience level; **Apple Health / Health Connect** sync (write workouts, read weight); Help, rate the app, share with friends (referral link).
5. Streak rule check: with every-other-day training the 1-rest-day-per-week streak breaks; show "Do a 10-min mobility on rest days to keep your streak" on the day after a workout.

## Not copying from Gymverse

- 80+ minute default workouts and 5 × heavy sets for everyone.
- Huge swap lists (we keep ≤5 recommended; the Library is where people browse).
- Global leaderboards, public body photos, calorie/protein targets for teens.
- Dark gym-bro visual style.
