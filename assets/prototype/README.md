# Exercise demo videos (development builds only)

Every exercise has two clips, made in Google Flow from our body references
(Daniel, Phase 20):

- woman: reference `assets/bodies/body-adult-f-front.webp` → `<slug>.f.mp4`
- man: reference `assets/bodies/body-adult-m-front.webp` → `<slug>.m.mp4`

`<slug>` is the exercise id in `supabase/seed/exercises.json` (main and
Repair exercises). Put the files here and run `npm run prototype:videos`. It
rewrites `videos.js`, the manifest the app reads (slug → `{ f, m }`), so the
app never probes for files.

The app shows each profile only its own sex's clip (the profile's sex, else
its body model; with neither it asks once "Show exercise demos with: Woman /
Man"). A missing clip shows the "demo coming soon" frame with the cues, never
the other sex's clip. One-sided moves get an "Other side" button that mirrors
the clip. Teens and 60+ use the adult clip of their sex for now.

Older `ex-*.mp4` placeholders can still be listed in `map.json` as
`{ "ex-pushup.mp4": { "slug": "push_up", "sex": "f" } }`; a file without a sex
is skipped.

The clips are loaded only inside `if (__DEV__) { … }`, so release builds drop
them, and `npm run bundle:check` fails if any clip reaches a release bundle
(the videos stay behind the "in review" flag until the reviewer approves).
Never mark an exercise `released` with prototype media: the database refuses
it too.
