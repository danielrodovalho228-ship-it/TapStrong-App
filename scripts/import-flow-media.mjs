// Imports a batch of raw Google Flow downloads into assets/prototype/
// (docs/media-import-1.md). Reusable for the next batches.
//
// Accepted raw names: <slug>.<f|m>[_v<N>]_<YYYYMMDDhhmmss>.<mp4|jpg>
//   f = woman, m = man; the jpg is the clip's starting image. The same file
//   may come several times (the Flow project downloaded more than once):
//   per slug + sex + type the highest _vN wins, then the newest stamp.
// Junk, never imported: x_bad_* (bad takes), body-adult-* (references) and
// Flow's automatic names (Man_performing_…, Woman_demonstrating_…).
// A slug that isn't in supabase/seed/exercises.json or repair_tests.json is
// listed, never invented.
//
// Output:
//   assets/prototype/<slug>.<f|m>.mp4          H.264, CRF 26, 720×1280, no audio, faststart, ≤30 fps
//   assets/prototype/posters/<slug>.<f|m>.webp 480 px wide, q70 (from the jpg, else the first frame)
//   <qc dir>/<slug>.<f|m>.jpg                  6 frames, one every ~1.3 s, for the frame-by-frame check
//   <report>                                   what was kept, replaced, discarded, unknown
//
// Usage: node scripts/import-flow-media.mjs [--dry-run] [--no-encode] [--delete-raw] [--qc <dir>] [--report <file>]
//   --no-encode   keep the final files already made (e.g. to only --delete-raw)
//   --delete-raw  git rm the raw files once processed (and the junk)
// Then look at every QC strip, list the suspects in assets/prototype/qc.json
// and run npm run prototype:videos.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'assets', 'prototype');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const dryRun = flag('--dry-run');
const encode = !dryRun && !flag('--no-encode');
const qcDir = value('--qc');
const reportFile = value('--report');

export const RAW = /^([a-z0-9_]+)\.(f|m)(?:_v(\d+))?_(\d{14})\.(mp4|jpg)$/;
/** Files that belong to the app and stay: the final clips, the manifest and docs. */
export const FINAL = /^[a-z0-9_]+\.(f|m)\.mp4$/;
const KEEP = new Set(['README.md', 'map.json', 'videos.js', 'qc.json', 'posters']);

export function classify(name) {
  if (KEEP.has(name) || FINAL.test(name) || /^ex-.*\.mp4$/.test(name)) return 'keep';
  if (name.startsWith('x_bad_')) return 'bad';
  if (name.startsWith('body-adult-')) return 'reference';
  if (RAW.test(name)) return 'raw';
  return 'automatic';
}

/** Per slug + sex + type: the highest version, then the newest stamp. */
export function pickNewest(names) {
  const groups = new Map();
  for (const name of names) {
    const m = name.match(RAW);
    if (!m) continue;
    const [, slug, sex, v, stamp, ext] = m;
    const key = `${slug}.${sex}.${ext}`;
    const entry = { name, slug, sex, ext, version: Number(v ?? 1), stamp };
    const prev = groups.get(key);
    if (
      !prev ||
      entry.version > prev.version ||
      (entry.version === prev.version && entry.stamp > prev.stamp)
    )
      groups.set(key, entry);
  }
  return groups;
}

function knownSlugs() {
  const slugs = new Set(
    JSON.parse(readFileSync(join(ROOT, 'supabase/seed/exercises.json'), 'utf8')).exercises.map(
      (e) => e.slug,
    ),
  );
  const repair = join(ROOT, 'supabase/seed/repair_tests.json');
  if (existsSync(repair))
    for (const t of JSON.parse(readFileSync(repair, 'utf8')).tests ?? []) slugs.add(t.slug ?? t.id);
  return slugs;
}

const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
const probe = (file) =>
  execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=r_frame_rate:format=duration',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );

function encodeVideo(src, out) {
  const info = JSON.parse(probe(src));
  const [n, d] = (info.streams?.[0]?.r_frame_rate ?? '30/1').split('/').map(Number);
  const fps = d ? n / d : 30;
  // 9:16 at 720×1280, padded if a source is off; 24–30 fps.
  const vf = [
    'scale=720:1280:force_original_aspect_ratio=decrease',
    'pad=720:1280:(ow-iw)/2:(oh-ih)/2',
    ...(fps > 30 ? ['fps=30'] : fps < 24 ? ['fps=24'] : []),
  ].join(',');
  ff(
    '-i',
    src,
    '-an',
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '26',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out,
  );
}

function encodePoster(src, out, fromVideo) {
  ff(
    ...(fromVideo ? ['-ss', '0.2'] : []),
    '-i',
    src,
    '-frames:v',
    '1',
    '-vf',
    'scale=480:-2',
    '-c:v',
    'libwebp',
    '-quality',
    '70',
    out,
  );
}

function qcStrip(src, out) {
  // 6 frames, one every ~1.3 s, side by side.
  ff('-i', src, '-vf', 'fps=1/1.3,scale=180:-2,tile=6x1', '-frames:v', '1', '-q:v', '5', out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = readdirSync(DIR).sort();
  const slugs = knownSlugs();
  const discarded = { bad: [], reference: [], automatic: [], older: [] };
  const raw = [];
  for (const name of names) {
    const kind = classify(name);
    if (kind === 'raw') raw.push(name);
    else if (kind !== 'keep') discarded[kind].push(name);
  }
  const newest = pickNewest(raw);
  const winners = new Set([...newest.values()].map((e) => e.name));
  discarded.older = raw.filter((n) => !winners.has(n));
  const unknown = [
    ...new Set([...newest.values()].filter((e) => !slugs.has(e.slug)).map((e) => e.slug)),
  ];

  const clips = {};
  for (const e of newest.values()) {
    if (!slugs.has(e.slug)) continue;
    clips[`${e.slug}.${e.sex}`] = { ...clips[`${e.slug}.${e.sex}`], [e.ext]: e.name };
  }
  const bytes = (f) => statSync(join(DIR, f)).size;
  const before = names.filter((n) => classify(n) !== 'keep').reduce((s, n) => s + bytes(n), 0);
  mkdirSync(join(DIR, 'posters'), { recursive: true });
  if (qcDir) mkdirSync(qcDir, { recursive: true });
  const done = [];
  for (const [key, c] of Object.entries(clips).sort()) {
    const entry = { key, video: c.mp4 ?? null, image: c.jpg ?? null };
    if (encode && c.mp4) {
      encodeVideo(join(DIR, c.mp4), join(DIR, `${key}.mp4`));
      encodePoster(join(DIR, c.jpg ?? c.mp4), join(DIR, 'posters', `${key}.webp`), !c.jpg);
      if (qcDir) qcStrip(join(DIR, `${key}.mp4`), join(qcDir, `${key}.jpg`));
    }
    if (!dryRun && c.mp4 && existsSync(join(DIR, `${key}.mp4`))) {
      entry.size = bytes(`${key}.mp4`);
      entry.poster = statSync(join(DIR, 'posters', `${key}.webp`)).size;
    }
    done.push(entry);
  }
  const after = done.reduce((s, e) => s + (e.size ?? 0) + (e.poster ?? 0), 0);
  const report = { before, after, clips: done, unknown, discarded };
  if (reportFile) writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  if (!dryRun && flag('--delete-raw')) {
    const remove = [...raw, ...discarded.bad, ...discarded.reference, ...discarded.automatic];
    for (let i = 0; i < remove.length; i += 100)
      execFileSync(
        'git',
        [
          'rm',
          '-q',
          '--cached',
          '--ignore-unmatch',
          '--',
          ...remove.slice(i, i + 100).map((n) => join('assets/prototype', n)),
        ],
        { cwd: ROOT },
      );
    for (const n of remove) execFileSync('rm', ['-f', join(DIR, n)]);
  }
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
  console.log(
    `${done.filter((e) => e.video).length} clips, ${done.filter((e) => !e.video).length} images without a clip; ` +
      `${Object.values(discarded).flat().length} discarded; unknown slugs: ${unknown.length}; ` +
      `raw ${mb(before)} → final ${mb(after)}${dryRun ? ' (dry run)' : ''}`,
  );
}
