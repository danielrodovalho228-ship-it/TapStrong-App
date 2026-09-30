// Phase 28 — every share card × 3 backgrounds × 3 languages × 2 formats, in
// adult and 60+ type, drawn by the dev route /dev/cards and checked for cut
// text: no text box may overflow (clipped or ellipsized) and nothing may sit
// outside the card. The transparent sticker is drawn over a sample photo
// (scripts/fixtures/sample-photo.jpg, no person in it).
//
// Pictures for the report (pt-BR, both formats, light / dark / sticker) go to
// docs/screenshots/share-cards/; every other render goes to SHARE_CARDS_ALL
// (default: a temp folder). Then the composer in teen, adult and 60+ mode.
// Run: node scripts/shoot-share-cards.mjs  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';

const TEMPLATES = [
  'workout',
  'sticker',
  'muscle',
  'exercise',
  'achievement',
  'week',
  'month',
  'fun',
];
const BACKGROUNDS = ['light', 'dark', 'transparent'];
const FORMATS = ['story', 'feed'];
const LOCALES = ['en', 'es', 'pt-BR'];
const MODES = ['adult', 'senior'];
const REPORT_LOCALE = 'pt-BR';

const photo = `data:image/jpeg;base64,${readFileSync(
  new URL('./fixtures/sample-photo.jpg', import.meta.url),
).toString('base64')}`;

const report = join(process.cwd(), 'docs', 'screenshots', 'share-cards');
const all = process.env.SHARE_CARDS_ALL ?? mkdtempSync(join(tmpdir(), 'share-cards-'));
mkdirSync(report, { recursive: true });
mkdirSync(all, { recursive: true });

const dir = process.env.THEME_EXPORT_DIR ?? mkdtempSync(join(tmpdir(), 'share-web-'));
if (!process.env.THEME_EXPORT_DIR) exportWeb(dir);
const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });
const failed = [];
let rendered = 0;

/** Text boxes that are cut (overflow or ellipsis) or outside the card. */
function findCuts() {
  const card = document.querySelector('[data-testid^="share-card-"]');
  if (!card) return ['no card'];
  const box = card.getBoundingClientRect();
  const out = [];
  for (const el of card.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    const text = el.textContent.trim().slice(0, 40);
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)
      out.push(`cut: "${text}"`);
    if (
      r.left < box.left - 1 ||
      r.right > box.right + 1 ||
      r.top < box.top - 1 ||
      r.bottom > box.bottom + 1
    )
      out.push(`outside: "${text}"`);
  }
  return out;
}

try {
  const context = await browser.newContext({
    viewport: { width: 420, height: 700 },
    deviceScaleFactor: 2,
  });
  // A profile so the app renders; the dev route draws the card by itself.
  await context.addInitScript(
    (p) => {
      localStorage.setItem('tapstrong\\onboarding', p);
    },
    JSON.stringify(profile(1988, true, { sex: 'f' })),
  );
  const page = await context.newPage();

  for (const mode of MODES)
    for (const locale of LOCALES)
      for (const template of TEMPLATES)
        for (const bg of BACKGROUNDS)
          for (const format of FORMATS) {
            const q = new URLSearchParams({ template, bg, format, lang: locale, mode });
            await page.goto(`${origin}/dev/cards?${q}`, { waitUntil: 'load' });
            const stage = page.locator('[data-testid="card-stage"]');
            await stage.waitFor({ timeout: 15000 });
            await page.waitForTimeout(400);
            if (bg === 'transparent')
              await page.evaluate((src) => {
                const s = document.querySelector('[data-testid="card-stage"]');
                s.style.backgroundImage = `url(${src})`;
                s.style.backgroundSize = 'cover';
                s.style.backgroundPosition = 'center';
              }, photo);
            const cuts = await page.evaluate(findCuts);
            const name = `${mode}-${locale}-${template}-${format}-${bg === 'transparent' ? 'sticker' : bg}`;
            if (cuts.length) failed.push(`${name}: ${cuts.join('; ')}`);
            const inReport = mode === 'adult' && locale === REPORT_LOCALE;
            await stage.screenshot({
              path: join(
                inReport ? report : all,
                `${inReport ? name.slice(`adult-${REPORT_LOCALE}-`.length) : name}.jpg`,
              ),
              type: 'jpeg',
              quality: 72,
            });
            rendered++;
          }
  await context.close();

  // The composer in the three modes (pt-BR).
  const years = { teen: new Date().getFullYear() - 15, adult: 1988, senior: 1956 };
  const today = new Date().toISOString().slice(0, 10);
  const seed = JSON.parse(
    readFileSync(new URL('../supabase/seed/exercises.json', import.meta.url)),
  );
  const squat = seed.exercises.find((e) => e.pattern === 'squat' && e.parts?.includes('main'));
  const primary = (squat.muscles ?? []).find((m) => m[1] === 'primary')?.[0];
  const w = {
    id: '00000000-0000-4000-8000-000000000028',
    kind: 'regular',
    createdAt: `${today}T09:00:00`,
    startedAt: `${today}T09:00:00`,
    endedAt: `${today}T09:40:00`,
    status: 'done',
    session: {
      items: [
        {
          id: 'i0',
          role: 'main',
          part: 'main',
          exerciseId: squat.slug,
          targetMuscle: primary,
          goal: 'grow',
          sets: 3,
          reps: [8, 12],
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 300,
        },
      ],
      minutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 40,
      notes: [],
    },
    logs: [1, 2, 3].map((setNo) => ({
      itemId: 'i0',
      exerciseId: squat.slug,
      setNo,
      reps: 10,
      loggedAt: `${today}T09:1${setNo}:00`,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  };
  for (const [mode, year] of Object.entries(years)) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
    });
    await ctx.addInitScript(
      (e) => {
        for (const [k, v] of Object.entries(JSON.parse(e)))
          localStorage.setItem(`tapstrong\\${k}`, v);
      },
      JSON.stringify({
        onboarding: JSON.stringify(profile(year, true, { locale: 'pt-BR', sex: 'f' })),
        workouts: JSON.stringify({ state: { workouts: [w] }, version: 2 }),
      }),
    );
    const page2 = await ctx.newPage();
    await page2.goto(`${origin}/share?workout=${w.id}&template=workout`, { waitUntil: 'load' });
    await page2.waitForTimeout(1500);
    // Teens are app-only on the web: lift the gate to see the screen under it.
    await page2.evaluate(() => {
      const gate = document.querySelector('[data-testid="web-family-gate"]');
      if (!gate) return;
      const app = gate.previousElementSibling;
      gate.remove();
      if (app) app.style.display = 'flex';
    });
    await page2.waitForTimeout(300);
    await page2.screenshot({
      path: join(report, `composer-${mode}.jpg`),
      type: 'jpeg',
      quality: 72,
      fullPage: true,
    });
    await ctx.close();
  }
} finally {
  await browser.close();
  close();
}
if (failed.length) {
  console.error(
    `shoot-share-cards: ${failed.length} of ${rendered} renders have cut text:\n- ${failed.join('\n- ')}`,
  );
  process.exit(1);
}
console.log(`OK: ${rendered} cards, no cut text. Report pictures in ${report}; all in ${all}`);
