# Prototype demo videos (development builds only)

Copy the AI prototype loops here from
`C:\Users\danie\OneDrive\Daniel\Aplicativo\App Gym Flex\Imagens\ex-*.mp4`,
then say which exercise each one shows in `map.json`:

```json
{ "ex-pushup.mp4": "push_up" }
```

Then run `npm run prototype:videos`. It rewrites `videos.js`.

These clips are placeholders (SPEC §6). They are loaded only inside
`if (__DEV__) { … }`, so release builds drop them, and `npm run bundle:check`
fails if any of them reaches a release bundle. Never mark an exercise
`released` with prototype media — the database refuses it too.
