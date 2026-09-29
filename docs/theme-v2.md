# TapStrong theme v2 — "Coral suave" (Day / Night)

Approved by Daniel as Phase 17 (after Phase 16): "novo tema 'Coral suave' com modo dia e noite. […] implemente, com testes e relatório em português no fim."

Goal: look like a modern fitness app, softer than today, with a standard appearance setting. Follow platform conventions; don't invent new patterns.

## Appearance setting

- Settings → Appearance: **Automatic (follows the phone)** · Light · Dark. Default Automatic (`useColorScheme`), saved per device. Applies instantly, no restart.
- Status bar, navigation bar (Android), splash and keyboard follow the theme.

## Tokens (replace the current palette; every screen uses tokens, no hard-coded colors — add a lint rule/test that fails on hex literals outside the theme file)

| Token                                     | Light (Day)                 | Dark (Night)                |
| ----------------------------------------- | --------------------------- | --------------------------- |
| bg                                        | #FAF7F4                     | #15171B                     |
| surface (cards)                           | #FFFFFF                     | #1F2227                     |
| surfaceRaised (hero card)                 | #2A2623                     | #262A30                     |
| onSurfaceRaised                           | #FFFFFF                     | #F1EEEA                     |
| text                                      | #1E1C1A                     | #F1EEEA                     |
| textMuted                                 | #7A726B                     | #A39D96                     |
| line                                      | #EAE4DE                     | #2E3238                     |
| primary (action)                          | #E8573F                     | #FF7A63                     |
| onPrimary                                 | #FFFFFF                     | #1A0F0C                     |
| primarySoft (eyebrows, chips selected bg) | #FFE3DC                     | #3A2622                     |
| tabBar                                    | #FFFFFF                     | #1B1D22                     |
| success / warning / danger                | #2E9E6B / #E0A100 / #D64545 | #4CC38A / #F2C94C / #FF6B6B |

- **Recovery colours never change** with the theme: red #C43E1C, orange #EF6B4A, peach #F6B195, grey-blue #8FA3B8, white #FFFFFF (dot ring #333 in both modes).
- **Body images** keep their #E9E5DE background: in Dark mode the body map sits inside a light card (#E9E5DE) with 16 px radius, never inverted.
- Only primary buttons, the active tab, today's day in the week strip and progress marks use `primary`. Everything else stays neutral.
- Contrast: all text/background pairs ≥ WCAG AA (4.5:1 body, 3:1 large); add a unit test that checks every token pair in both modes.
- 60+ mode keeps its larger type; teen mode same palette.
- Charts (Progress) and badges read colours from tokens; check both modes.

## Screens to verify in both modes (screenshot test per mode)

Welcome, onboarding chat, body map, goals, Home (adult + 60+), workout list, player, rest, done, swap sheet, Library, exercise page, Progress (Activity + Body), Plans, Equipment, Settings, Family, paywall, parent PIN.

## Store assets

Update the mockups/screenshots list in docs/store with Light versions first (store listing), Dark as extra.
