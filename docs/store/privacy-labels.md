# Privacy labels — App Store "App Privacy" and Google Play "Data safety"

Data inventory of the app as built (Phase 8), for the store forms and for the
lawyer's privacy-policy review (SPEC §13). Re-check before each release.

## What the app collects

| Data                                                        | Where it goes                                                   | Linked to the person                          | Purpose                                  | Notes                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Email address                                               | Supabase Auth                                                   | Yes                                           | Account, sign-in codes                   | Only after "Save progress"; never for a child's own login                       |
| User ID (account id)                                        | Supabase, RevenueCat                                            | Yes                                           | Account, purchases                       | RevenueCat app user id = Supabase user id                                       |
| Birth month and year, sex or neutral body                   | Supabase `profiles`                                             | Yes                                           | App functionality (age mode, body model) | No full date of birth                                                           |
| Height, weight (optional)                                   | Supabase `profiles`                                             | Yes                                           | App functionality (body model)           | Never for under-13 (database check)                                             |
| Health answers: pain areas, conditions, training position   | Supabase `health_screen`                                        | Yes                                           | App functionality (safety filters)       | Never sent to analytics                                                         |
| Fitness: workouts, sets, swaps, pain reports, streaks       | Supabase                                                        | Yes                                           | App functionality                        |                                                                                 |
| Check-ins: strength; waist, weight, WHtR, BMI (adults only) | Supabase `checkins`                                             | Yes                                           | App functionality                        | Body fields refused by the database for under-18                                |
| Repair results and plans                                    | Supabase                                                        | Yes                                           | App functionality                        |                                                                                 |
| Coach interview free text                                   | Supabase Edge Function → Anthropic (Claude API)                 | Processed, not stored                         | App functionality                        | Not offered to children (guided choices only)                                   |
| Purchase history                                            | App Store / Google Play → RevenueCat → Supabase `subscriptions` | Yes                                           | Purchases                                |                                                                                 |
| Product interaction events (SPEC §10)                       | PostHog, only when its key is set                               | No (anonymous install id, no person profiles) | Analytics                                | No health data, no names, no emails; nothing from a child profile               |
| Crash data                                                  | Sentry, only when its DSN is set                                | No (no default PII, user field dropped)       | App functionality (diagnostics)          |                                                                                 |
| Before/after photos                                         | **Stay on the phone**                                           | —                                             | —                                        | Never uploaded; adults (and 60+ if turned on) only                              |
| Notifications                                               | Device only                                                     | —                                             | —                                        | Reminders are local notifications scheduled on the phone; no push token is sent |

Not collected: precise or coarse location, contacts, browsing history,
advertising identifier, audio, photos (uploaded), financial info (card data
stays with the stores).

## App Store Connect answers

- **Tracking:** No. No data is used to track people across apps or websites; no ad SDKs.
- **Data linked to you:** Contact Info (Email Address); Health & Fitness (Health, Fitness); Identifiers (User ID); Purchases (Purchase History); User Content (Other User Content: coach interview text, processed only); Other Data (birth month/year).
- **Data not linked to you:** Usage Data (Product Interaction); Diagnostics (Crash Data).
- **Purposes:** App Functionality for everything; Analytics for Product Interaction.

## Google Play Data safety answers

- Data collected: Personal info (Email address, User IDs, Other info: birth month/year); Health and fitness (Health info, Fitness info); Financial info (Purchase history); App activity (App interactions, Other user-generated content); App info and performance (Crash logs).
- Data shared with third parties: No sharing for their own purposes. Service providers (Supabase, RevenueCat, Anthropic, PostHog, Sentry) process data on our behalf, which Google does not count as sharing.
- Encrypted in transit: Yes.
- Deletion: Yes, in the app (Account → Delete account) deletes the account and all its data; the store subscription is cancelled in the store.
- Target audience includes children (9–12 via a parent's Family plan): answer the Families policy questions; the lawyer confirms the COPPA method (store transaction + parent notice).

## Age rating

Health & Fitness, no objectionable content. Apple: 4+ is likely, but the
app is not in the Kids category (mixed audience, children only through a
parent). Google: complete the IARC questionnaire; declare the mixed audience.
