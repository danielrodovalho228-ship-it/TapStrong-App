# Phase 14 — screen map (improvements v1)

Each new screen is mapped to an existing mockup (`docs/mockups/`) or given a text layout, as Daniel asked. All screens use the TapStrong light tokens, work in teen, adult and 60+ modes, and go through i18n.

| Item | Screen / route | Mockup it follows | Layout |
|---|---|---|---|
| A1 Week strip | Home header + workout list (`components/WeekStrip`) | 06/07 Home header | Row of 7 day cells (week start from the phone), today outlined in accent; solid dot = trained, hollow dot = planned (the days-per-week plan). Tap → `/day/[date]`. 60+: same strip, larger cells, no numbers besides the day. |
| A1 Day view | `/day/[date]` | 10 Workout list | Header with the date; past day: the logged workout(s) as mockup 10 cards (read-only); future day: preview of the session the generator would build, with "Start" only on today. |
| A2 Block label | Home card eyebrow + workout header | 07 Home card eyebrow | "Week 3 of 5 · Build" / "Deload" + day name ("Push", "Full body", "Mobility", "Repair"). |
| A3 Summary line | Home card + workout header | 07 / 10 | "6 exercises · 45 min"; adults: "· ~210 kcal" from the stored weight; never teens; 60+ keeps just minutes. |
| A4 Suggested load | Workout list rows + player logger | 10 / 11 | Row shows "3 × 10–12 · 25 lb". First time: player asks "Pick a weight you could lift 2 more times" above the load field. |
| A5 Ready-made plans | Library tab → "Plans" segment; `/program/[id]` | 19 Plans cards | Filter chips (days, goal, split, duration); card = name, "3 days · Full body · 45 min", goal tag. Detail: week layout (day names), "Use this plan" / "Back to My plan". "My plan" card pinned first. 60+ sees only suitable plans (60+ strong & steady, mobility & balance, full body). |
| A6 Workout modes | Home card "Pick something else" → `/workout/new` | 09 Goals (choice cards) | Three radio cards: My plan / Single workout (opens the body map, one session, profile goals untouched) / Custom (`/workout/custom`: mockup 10 list with "Add exercise" from the Library, safety-filtered). |
| A7 Share today's workout | Done + workout header | 15 Share | Same share card rules; button hidden for a teen on a Family plan unless the parent turned sharing on. |
| B1 Library tab | `/(tabs)/library` | 08 Body map + 10 cards | Segment [Exercises · Plans]. Exercises: search field, filter chips (equipment, position, role), `BodyMapCanvas` with front/back toggle (tap a dot filters by muscle), 2-column grid of cards; collapsed "Not for you right now" with the reason. 60+: no body map, area buttons (arms, legs, back, chest, core, balance) and a single-column list. |
| B2 Grid card | component | 10 row | Thumbnail slot, name, star. |
| B3 Exercise page | `/exercise/[id]` | 11 Player (demo + cues) + 18 Progress (chart) | Tabs [Guidance · Performance]. Guidance: demo, cues, common mistakes, "Muscles worked" with read-only `BodyMapCanvas` dots (primary solid, secondary outlined) front and back. Performance: PR tiles (heaviest, est. 1RM Epley, best set volume), bar chart by session, past sessions, private note. Teens: no 1RM/volume tiles (reps and consistency only); 60+: heaviest + sessions only. |
| B4 Favourites | star on card/page | — | Starred and safe → preferred by the generator and swap sheet. |
| B5 Create exercise | `/exercise/new` (adults only) | 09 Goals (body map pick) | Name field, primary/secondary picked on the body map, equipment chips, joints used. Shows "Not reviewed by a coach". Only usable in Custom workouts. |
| C1–C2 Equipment | `/settings/equipment`; onboarding schedule step | 20 Restrictions (grouped toggles) | Preset chips (Full gym, Small gym, Home gym, Bodyweight only, Hotel) + saved profiles ("Gym", "Home") on top; groups with item toggles below. Workout header: profile switcher chip. |
| D1 Activity | Progress tab → segment [Activity · Body] | 18 Progress | Range chips 7D/30D/6M/12M/All; tiles: workouts, hours, volume, mobility sessions; month calendar; exercise graph with goal line. 60+: workouts, hours, calendar only. Teens: no volume tile. |
| D2 Badges | Progress + milestone | 24 Milestone badges | Grid of badges with progress; teens: streak/consistency only. |
| D3 Body | Progress → Body (adults only) | 25 Check-in + 26 Before/after | Weight trend, WHtR first, optional tape measures, link to before/after. Hidden for teens. |
| D4 Settings | `/settings` | none — text layout | Grouped list: Workout (units, rest timer default, warm-up/cool-down length, experience level, demo model), Sounds & voice, Reminders (days + time, motivational on/off), Equipment, Account & plan, Help (support email, rate, share). |
| D5 Streak hint | Home | 07 note row | Teal note the day after a workout: "Do a 10-min mobility on rest days to keep your streak". |

## Not built in this phase (needs Daniel's OK)

- **Apple Health / Health Connect:** new native modules (a stack change and a new development build), so it needs Daniel's OK first. Weight comes from the profile, and the kcal estimate uses it (adults only).
- **"Rate the app"** links to the store page once the store accounts exist.
