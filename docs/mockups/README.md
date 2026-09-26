# TapStrong — mockup screens

Reference images (390×844 @2x) exported from the design canvas. Match layout, hierarchy, copy and tokens; build real components, don't copy HTML. Images/videos inside are placeholders from the prototype.

| # | File | Screen | Route (SPEC §9) |
|---|---|---|---|
| 01 | 01-Main.png | 1 · Welcome | `/welcome` |
| 02 | 02-AgeGate.png | 1b · Who's training + age mode | `/onboarding/who` |
| 03 | 03-Chat.png | 2 · Coach interview | `/onboarding/chat` |
| 04 | 04-HealthCheck.png | 2b · Safety check | `/onboarding/safety` |
| 05 | 05-Profile.png | 3 · Profile summary | `/onboarding/profile` |
| 06 | 06-HomeNew.png | 4a · Home · first week | `/(tabs)/home (week 1)` |
| 07 | 07-Home.png | 4b · Home · week 4 | `/(tabs)/home (week 4+)` |
| 08 | 08-BodyMap.png | 5 · Body map | `/(tabs)/body` |
| 09 | 09-Goals.png | 6 · Goal + quantities | `/goals` |
| 10 | 10-Workout.png | 7 · Generated workout | `/workout/[id]` |
| 11 | 11-Player.png | 8 · Workout player (3D) | `/workout/[id]/play` |
| 12 | 12-Rest.png | 8a · Rest between sets | `/workout/[id]/rest` |
| 13 | 13-ExitConfirm.png | 8e · End workout? | `/workout/[id]/exit` |
| 14 | 14-Done.png | 8b · Workout done (body turns red) | `/workout/[id]/done` |
| 15 | 15-Share.png | 8c · Share card (viral loop) | `/share` |
| 16 | 16-Account.png | 8d · Save progress (sign-up after value) | `/account` |
| 17 | 17-Repair.png | 9 · Repair check | `/repair` |
| 18 | 18-Progress.png | 10 · Progress | `/(tabs)/progress` |
| 19 | 19-Plans.png | 11 · Plans & family | `/(tabs)/family · /plans` |
| 20 | 20-Restrictions.png | 12 · My restrictions | `/restrictions` |
| 21 | 21-PainSwap.png | 13 · Pain → safe swap | `/workout/[id]/pain` |
| 22 | 22-Billing.png | 14 · Honest billing | `/billing` |
| 23 | 23-Senior.png | 15 · 60+ mode home | `senior mode home` |
| 24 | 24-Milestone.png | 11b · Celebration: 7-day streak + badges | `/milestone` |
| 25 | 25-CheckIn.png | 10b · 4-week check-in (index + results) | `/checkin` |
| 26 | 26-BeforeAfter.png | 10c · Before & after (private photos) | `/before-after` |

## Main flows
- **First run:** 01 → 02 → 03 → 04 → 05 → 08 → 09 → 10 → 11 ⇄ 12 → 14 → 15 / 16 → 06
- **Under 13:** 02 → 19 (parent sets up the profile) · **60+:** 02 → 23
- **During workout:** pain 11 → 21 · exit 11 → 13
- **Returning user:** 07 (week 4+, recovery map, suggested day) → 24 streak · 25 check-in → 26 photos
- **Plans:** 19 → 22 · **Progress:** 18 → 25
