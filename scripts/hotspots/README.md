# Body-map hotspots

Builds `src/features/bodymap/hotspots.json` for the 28 body images and draws
check sheets so every point can be verified by eye (SPEC §5).

1. `reference.json`: SPEC §5 points for `adult-m`, with three fixes made on
   that image: quads y 340 → 330, knees y 383 → 362, back glutes y 248 → 262.
2. `build.py` finds landmarks on each silhouette (head top, crotch, feet,
   shoulder width) and maps the reference points onto each body.
3. `adjust.json` holds manual fixes where detection is wrong (long shorts or
   touching thighs hide the crotch) or a body's proportions differ.

```bash
pip install pillow
python3 scripts/hotspots/build.py            # writes hotspots.json
python3 scripts/hotspots/build.py --sheets out/   # also writes check sheets
```

Open the sheets and check every dot before committing.
