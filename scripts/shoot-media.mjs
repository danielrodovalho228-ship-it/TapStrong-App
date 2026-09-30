// Media import 1: in-app check of the imported demo clips (development web
// export). 10 exercises (seated, floor, standing) for a woman 60+ and a man
// (teens are app-only on web since Phase 24; their clip rule is unit-tested
// in src/features/exercises/videos.test.tsx): the clip and poster of the profile's own sex, the poster before play,
// "Other side" mirroring one-sided moves, and "demo coming soon" where the
// sex has no clip (a QC suspect or none made). Screenshots in
// docs/screenshots/media/.
// Run: node scripts/shoot-media.mjs  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';

// [slug, where, one-sided]
const EXERCISES = [
  ['su_seated_towel_overhead_press', 'seated', false],
  ['bal_seated_reach_outs', 'seated', false],
  ['sl_seated_heel_dig_hold', 'seated', true],
  ['dead_bug', 'floor', true],
  ['incline_plank', 'floor', false],
  ['prone_back_extension', 'floor', false],
  ['sumo_squat', 'standing', false],
  ['single_leg_balance', 'standing', true],
  ['low_step_up', 'standing', true], // .f is a QC suspect: coming soon for her
  ['wall_push_up', 'standing', false], // .f is a QC suspect
];
// No clip at all for either sex.
const NO_CLIP = 'push_up';
const PROFILES = [
  { id: 'woman-60', sex: 'f', birthYear: 1956 },
  { id: 'man', sex: 'm', birthYear: 1990 },
];
const COMING_SOON = 'The demo video arrives with the licensed exercise library.';

const out = join(process.cwd(), 'docs', 'screenshots', 'media');
mkdirSync(out, { recursive: true });
const dir = process.env.THEME_EXPORT_DIR ?? mkdtempSync(join(tmpdir(), 'media-'));
if (!process.env.THEME_EXPORT_DIR) exportWeb(dir);
const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });
const failed = [];
const rows = [];
try {
  for (const p of PROFILES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'en',
      deviceScaleFactor: 1,
    });
    const entries = {
      onboarding: JSON.stringify(profile(p.birthYear, true, { sex: p.sex })),
    };
    await context.addInitScript((e) => {
      for (const [k, v] of Object.entries(e)) localStorage.setItem(`tapstrong\\${k}`, v);
    }, entries);
    const page = await context.newPage();
    for (const [slug, where, oneSided] of [...EXERCISES, [NO_CLIP, 'standing', false]]) {
      await page.goto(`${origin}/exercise/${slug}`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      // Read straight from the DOM: no locator waits.
      const { video, posterSrc, soon } = await page.evaluate((text) => {
        const poster = document.querySelector('[data-testid="demo-poster"]');
        return {
          video: document.querySelector('video')?.getAttribute('src') ?? null,
          posterSrc: poster?.querySelector('img')?.getAttribute('src') ?? null,
          soon: document.body.innerText.includes(text),
        };
      }, COMING_SOON);
      const other = p.sex === 'f' ? '.m.' : '.f.';
      const own = `.${p.sex}.`;
      const row = { profile: p.id, slug, where, clip: !!video, poster: !!posterSrc, soon: !!soon };
      if (video && !decodeURIComponent(video).includes(`${slug}${own}`))
        failed.push(`${p.id} ${slug}: clip ${video} is not the ${p.sex} clip`);
      for (const src of [video, posterSrc])
        if (src && decodeURIComponent(src).includes(`${slug}${other}`))
          failed.push(`${p.id} ${slug}: shows the other sex (${src})`);
      // Headless Chromium has no H.264, so the poster stays up: exactly the
      // "before play" state.
      if (video && !posterSrc) failed.push(`${p.id} ${slug}: no poster before play`);
      if (!video && !soon) failed.push(`${p.id} ${slug}: no clip and no "coming soon" frame`);
      const shot = `${p.id}-${slug}`;
      await page.screenshot({ path: join(out, `${shot}.jpg`), type: 'jpeg', quality: 70 });
      if (oneSided && video) {
        await page.getByRole('button', { name: 'Other side' }).click({ timeout: 5000 });
        await page.waitForTimeout(300);
        const flipped = await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('[data-testid="demo-poster"]') ?? document.body)
              .transform,
        );
        row.mirrored = flipped.startsWith('matrix(-1');
        if (!row.mirrored) failed.push(`${p.id} ${slug}: "Other side" did not mirror`);
        await page.screenshot({
          path: join(out, `${shot}-other-side.jpg`),
          type: 'jpeg',
          quality: 70,
        });
      }
      rows.push(row);
    }
    // The exercise card thumbnails (Library tab).
    await page.setViewportSize({ width: 390, height: 2600 });
    await page.goto(`${origin}/library`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const thumbs = await page.evaluate(
      () => document.querySelectorAll('[data-testid="exercise-thumb-poster"]').length,
    );
    if (!thumbs) failed.push(`${p.id}: no poster thumbnails in the Library`);
    await page.screenshot({ path: join(out, `${p.id}-library.jpg`), type: 'jpeg', quality: 70 });
    await context.close();
  }
} finally {
  await browser.close();
  close();
}
console.table(rows);
if (failed.length) {
  console.error(`shoot-media failed:\n- ${failed.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: media screenshots in ${out}`);
