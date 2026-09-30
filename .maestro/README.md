# Maestro E2E flows (SPEC §3, §12 Phase 8)

Main user flows, run on a development or preview build (not Expo Go):

```bash
# once: install Maestro (https://maestro.dev) and boot a simulator/emulator
eas build --profile preview --platform ios   # or android; install it on the device
maestro test .maestro/                       # all flows, in file order
maestro test .maestro/01-onboarding-adult.yaml
```

Flows use the English UI text (the device language must be English). Each
flow clears the app state first, so they run in any order.

| Flow                | What it proves                                                               |
| ------------------- | ---------------------------------------------------------------------------- |
| 01-onboarding-adult | Welcome → age gate → interview → safety → the first workout, then Home       |
| 02-first-workout    | Warm-up first, log sets, end, the body turns red, "Save progress" offered    |
| 03-pain-swap        | "I feel pain" → dull pain → safe swap and a saved restriction                |
| 04-child-blocked    | Under 13 cannot sign up alone (COPPA)                                        |
| 05-senior-home      | 60+ mode: big Start, 3 things on Home, no body-map tab, no photos by default |
| 06-paywall          | The 4th workout of the week opens the paywall with cancel info               |
| 07-tab-labels       | Tab labels read in full at 390 px; saves a screenshot to compare by eye      |

Released exercises are needed for workouts in a preview build; in a
development build the draft library is used.
