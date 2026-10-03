# Exercise review

`exercise-review.xlsx` is what the certified reviewer (e.g. NSCA-CSCS or ACSM) fills in for
the draft library (SPEC §2.1). One row per exercise; the reviewer only edits the two yellow
columns ("Approve / Fix" and "Comment") and the name/credential cell on the Instructions tab.

Rebuild after any change to `supabase/seed/exercises.json`:

```bash
pip install openpyxl
python3 scripts/build-review-sheet.py
```

When a sheet comes back, each approved row becomes a `certified` review in
`exercise_reviews` (with the reviewer's name and credential), and each "Fix" goes back to the
library as a draft change — which invalidates earlier reviews of that exercise.

## Launch set (first store release)

`launch-set.xlsx` holds only the exercises reviewed before the first store release
(Daniel, Oct 3), listed in `supabase/seed/launch_set.json`. The list is built from:

1. every exercise with an approved clip for both sexes;
2. every exercise a first workout can show (adults, teens, 60+; home and gym; warm-up and cool-down included);
3. the shoulder program;
4. the fewest extra exercises so every muscle on the Exercises map has 3 options at home and 3 at the gym.

The reviewer fills in Decision (Approve / Adjust / Reject) and Comment, plus their name,
credential and date on the Instructions tab. `launch-set-flow.md` lists the launch-set clips
still to make in Flow, in priority order.

```bash
npm run launch-set                     # rebuild the list (after library or media changes)
python3 scripts/build-launch-sheet.py  # rebuild the sheet and the Flow list
# once the clips are in Storage, link them for the reviewer:
python3 scripts/build-launch-sheet.py --media-base https://<project>.supabase.co/storage/v1/object/public/exercise-media
```
