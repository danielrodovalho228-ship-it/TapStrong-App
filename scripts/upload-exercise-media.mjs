// Uploads the approved Flow clips and posters to the `exercise-media` bucket
// (Phase 32, Daniel, Oct 3), where released exercises stream them from.
//
// Run it from your own terminal, never in a chat:
//
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SECRET_KEY=<sb_secret_… or the service_role key> \
//   node scripts/upload-exercise-media.mjs [--all] [--dry-run]
//
// By default only the launch set (supabase/seed/launch_set.json); --all sends
// every approved clip. Only clips that exist for BOTH sexes and passed the QC
// (not in qc.json "suspect") go up, with their posters. Files already in the
// bucket are replaced (a redone clip keeps its name). The key is read from the
// environment and never printed or written anywhere.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const MEDIA = join(ROOT, 'assets/prototype');
const BUCKET = 'exercise-media';
const all = process.argv.includes('--all');
const dry = process.argv.includes('--dry-run');

const url = process.env.SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!dry && (!url || !key)) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SECRET_KEY in this terminal (see the comment on top).',
  );
  process.exit(1);
}

const qc = JSON.parse(readFileSync(join(MEDIA, 'qc.json'), 'utf8'));
const suspect = qc.suspect ?? {};
const files = new Set(readdirSync(MEDIA));
const ok = (slug, sex) => files.has(`${slug}.${sex}.mp4`) && !suspect[`${slug}.${sex}`];
const slugs = all
  ? [...new Set([...files].filter((f) => f.endsWith('.mp4')).map((f) => f.split('.')[0]))]
  : JSON.parse(readFileSync(join(ROOT, 'supabase/seed/launch_set.json'), 'utf8')).exercises.map(
      (x) => x.slug,
    );
const ready = slugs.filter((s) => ok(s, 'f') && ok(s, 'm')).sort();

const uploads = ready.flatMap((slug) =>
  ['f', 'm'].flatMap((sex) => {
    const out = [
      { from: join(MEDIA, `${slug}.${sex}.mp4`), to: `${slug}.${sex}.mp4`, type: 'video/mp4' },
    ];
    const poster = join(MEDIA, 'posters', `${slug}.${sex}.webp`);
    if (existsSync(poster))
      out.push({ from: poster, to: `posters/${slug}.${sex}.webp`, type: 'image/webp' });
    return out;
  }),
);
const mb = uploads.reduce((n, u) => n + readFileSync(u.from).length, 0) / 1024 / 1024;
console.log(
  `${ready.length} exercises with both clips (${slugs.length - ready.length} waiting for clips): ` +
    `${uploads.length} files, ${mb.toFixed(1)} MB${dry ? ' (dry run, nothing sent)' : ''}`,
);
if (dry) process.exit(0);

const supabase = createClient(url, key, { auth: { persistSession: false } });
let failed = 0;
for (const u of uploads) {
  const { error } = await supabase.storage.from(BUCKET).upload(u.to, readFileSync(u.from), {
    contentType: u.type,
    upsert: true,
    cacheControl: String(30 * 24 * 3600),
  });
  if (error) {
    failed++;
    console.error(`failed: ${u.to}: ${error.message}`);
  }
}
if (!failed) {
  // The internal test build streams exactly these (src/features/exercises/videos.ts).
  const list = join(ROOT, 'assets/media/uploaded.json');
  const before = existsSync(list) ? JSON.parse(readFileSync(list, 'utf8')).slugs : [];
  const slugsUp = [...new Set([...before, ...ready])].sort();
  writeFileSync(
    list,
    `${JSON.stringify({ _comment: 'Written by scripts/upload-exercise-media.mjs: slugs with both clips in the exercise-media bucket.', slugs: slugsUp }, null, 2)}\n`,
  );
  console.log(
    `assets/media/uploaded.json: ${slugsUp.length} exercises. Commit it so the next internal build uses them.`,
  );
}
console.log(failed ? `${failed} uploads failed; run again to retry.` : 'all uploaded.');
process.exit(failed ? 1 : 0);
