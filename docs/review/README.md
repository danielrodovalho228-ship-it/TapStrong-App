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
