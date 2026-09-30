# Exercise demo videos (development builds only)

Every exercise has two clips, made in Google Flow from our body references
(Daniel, Phase 20):

- woman: reference `assets/bodies/body-adult-f-front.webp` → `<slug>.f.mp4`
- man: reference `assets/bodies/body-adult-m-front.webp` → `<slug>.m.mp4`

`<slug>` is the exercise id in `supabase/seed/exercises.json` (main and
Repair exercises).

## What goes in this folder

Only these files are committed (see `.gitignore`):

- `<slug>.<f|m>.mp4`: H.264, CRF 26, 720×1280, no audio, `+faststart`,
  24–30 fps, under 1 MB;
- `posters/<slug>.<f|m>.webp`: the clip's starting image, 480 px wide,
  quality 70, under 60 KB;
- `videos.js` (generated), `map.json`, `qc.json`, this README.

Raw Google Flow downloads (`<slug>.<f|m>[_vN]_<stamp>.mp4|jpg`) never stay.
Upload them here, then run:

```
node scripts/import-flow-media.mjs --qc <dir> --report <file>   # encode + QC strips
# look at every strip; list suspects in qc.json
node scripts/import-flow-media.mjs --no-encode --delete-raw     # remove the raw files
npm run prototype:videos
npm run media:redo                                               # docs/media-redo.md
```

The import keeps the newest take per slug + sex (highest `_vN`, then the
newest stamp) and drops `x_bad_*`, `body-adult-*` and Flow's automatic names.

## QC suspects

`qc.json` lists clips that failed the frame-by-frame check
(`{ "suspect": { "<slug>.<f|m>": "reason" } }`). Their file stays, but
`npm run prototype:videos` leaves them (and their poster) out of the manifest
until they are remade; then delete the line. `qc.json` also lists clips still to
make under `"missing"` (the import adds an image that came without its clip, and
removes a clip once it arrives). `npm run media:redo` turns both lists into
`docs/media-redo.md`, the redo list for Flow.

## The manifest

`npm run prototype:videos` rewrites `videos.js`, the manifest the app reads
(slug → `{ f, m, poster: { f, m } }`), so the app never probes for files. The
poster covers the player until the first frame plays and is the exercise
card's thumbnail; it follows the same sex rule as the clip.

The app shows each profile only its own sex's clip (the profile's sex, else
its body model; with neither it asks once "Show exercise demos with: Woman /
Man"). A missing clip shows the "demo coming soon" frame with the cues, never
the other sex's clip. One-sided moves get an "Other side" button that mirrors
the clip. Teens and 60+ use the adult clip of their sex for now.

Older `ex-*.mp4` placeholders can still be listed in `map.json` as
`{ "ex-pushup.mp4": { "slug": "push_up", "sex": "f" } }`; a file without a sex
is skipped.

The clips and posters are loaded only inside `if (__DEV__) { … }`, so release builds drop
them, and `npm run bundle:check` fails if any clip, poster or anything else from this
folder reaches a release bundle
(the videos stay behind the "in review" flag until the reviewer approves).
Never mark an exercise `released` with prototype media: the database refuses
it too.
