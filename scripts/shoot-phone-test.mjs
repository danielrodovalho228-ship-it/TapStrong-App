// Phase 29 (the phone test): the player (warm-up without a clip, an exercise
// with a clip), the swap sheet, the end of the first and of a later workout
// and Home, the workout menu, rest, the exercise page, plans, equipment and
// the Body tab, in teen, adult and 60+ mode, light and dark, as the preview link
// builds them (EXPO_PUBLIC_DEMO_MEDIA=1). It also measures, in the browser,
// that no text of the player sits on the media frame.
// Output: <out>/<mode>-<scheme>-<sex>-<name>.jpg (default docs/screenshots/phone-test)
// Run: node scripts/shoot-phone-test.mjs [exportDir] [outDir]
//   No exportDir: a fresh development export with the preview flag.
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, profile, serve } from './lib/web.mjs';

const [givenDir, givenOut] = process.argv.slice(2);
const out = givenOut ?? join(process.cwd(), 'docs', 'screenshots', 'phone-test');
mkdirSync(out, { recursive: true });
const dir = givenDir ?? mkdtempSync(join(tmpdir(), 'phone-test-'));
if (!givenDir)
  execSync(`npx expo export --clear --dev --platform web --output-dir ${dir}`, {
    stdio: 'ignore',
    env: { ...process.env, EXPO_OFFLINE: '1', CI: '1', EXPO_PUBLIC_DEMO_MEDIA: '1' },
  });

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const item = (slug, n, muscle) => ({
  id: `i${n}`,
  role: 'main',
  part: 'main',
  exerciseId: slug,
  targetMuscle: muscle,
  goal: 'grow',
  sets: 3,
  reps: [8, 12],
  restSeconds: 60,
  perSide: false,
  loadHint: null,
  estSeconds: 300,
});
const MOVES = [
  ['sit_to_stand', 'quads'],
  ['glute_bridge', 'glutes'],
];
const workout = (offset, id, done) => {
  const date = day(offset);
  return {
    id,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: done ? `${date}T09:30:00` : undefined,
    status: done ? 'done' : 'active',
    session: {
      items: MOVES.map(([slug, m], n) => item(slug, n, m)),
      minutes: 30,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: done
      ? MOVES.flatMap(([slug], n) =>
          [1, 2, 3].map((setNo) => ({
            itemId: `i${n}`,
            exerciseId: slug,
            setNo,
            reps: 10,
            loggedAt: `${date}T09:${10 + n * 5 + setNo}:00`,
          })),
        )
      : [],
    skipped: [],
    swaps: [],
    pains: [],
  };
};
const LIVE = '00000000-0000-4000-8000-000000000291';
const LAST = '00000000-0000-4000-8000-000000000292';
const EARLIER = '00000000-0000-4000-8000-000000000293';

const MODES = [
  { id: 'teen', year: new Date().getFullYear() - 15 },
  { id: 'adult', year: 1988 },
  { id: 'senior', year: 1956 },
];
const RUNS = [
  ...MODES.map((m) => ({ mode: m, scheme: 'light', sex: 'f' })),
  { mode: MODES[1], scheme: 'light', sex: 'm' },
  ...MODES.map((m) => ({ mode: m, scheme: 'dark', sex: 'f' })),
];

const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });
const failed = [];

async function liftGate(page) {
  await page.evaluate(() => {
    const gate = document.querySelector('[data-testid="web-family-gate"]');
    if (!gate) return;
    const app = gate.previousElementSibling;
    gate.remove();
    if (app) app.style.display = 'flex';
  });
}

/** Text boxes of the page that overlap the media frame (the dev badge aside). */
const overlaps = (page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-testid="demo-frame"]');
    if (!frame) return ['no media frame'];
    const f = frame.getBoundingClientRect();
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('[data-testid="demo-prototype-badge"]')) continue;
      if (getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden="true"]'))
        continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const inter =
        Math.min(r.right, f.right) - Math.max(r.left, f.left) > 1 &&
        Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top) > 1;
      if (inter) hits.push(text.slice(0, 40));
    }
    return hits;
  });

try {
  for (const { mode, scheme, sex } of RUNS) {
    const name = (n) => join(out, `${mode.id}-${scheme}-${sex}-${n}.jpg`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
      deviceScaleFactor: 1,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    const put = async (workouts) => {
      await page.evaluate(
        ([p, w]) => {
          localStorage.setItem('tapstrong\\onboarding', p);
          localStorage.setItem('tapstrong\\workouts', w);
        },
        [
          JSON.stringify(
            profile(mode.year, true, {
              locale: 'pt-BR',
              sex,
              location: 'home',
              minutes: 30,
              muscleGoals: [{ muscleKey: 'glutes', goal: 'firm' }],
            }),
          ),
          JSON.stringify({ state: { workouts }, version: 2 }),
        ],
      );
    };
    const go = async (path) => {
      await page.goto(`${origin}${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(1800);
      if (mode.id === 'teen') await liftGate(page);
    };
    await page.goto(`${origin}/`, { waitUntil: 'load' });

    // Home, then the generated first workout's first step (a warm-up).
    await put([]);
    await go('/home');
    await page.screenshot({ path: name('home'), type: 'jpeg', quality: 70 });
    await page.locator('[data-testid="start-hero"]').first().click();
    await page.waitForTimeout(1800);
    if (mode.id === 'teen') await liftGate(page);
    await page.screenshot({ path: name('player-warmup'), type: 'jpeg', quality: 70 });
    const o1 = await overlaps(page);
    if (o1.length) failed.push(`${mode.id}/${scheme}/${sex} warm-up: text on media: ${o1}`);

    // An exercise with a clip (sit to stand).
    await put([workout(0, LIVE, false)]);
    await go(`/workout/${LIVE}/play`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: name('player-clip'), type: 'jpeg', quality: 70 });
    const o2 = await overlaps(page);
    if (o2.length) failed.push(`${mode.id}/${scheme}/${sex} clip: text on media: ${o2}`);
    const video = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="demo-frame"] video');
      return v ? { src: v.currentSrc || v.src, inline: v.playsInline } : null;
    });
    if (!video?.src.includes(`sit_to_stand.${sex}`))
      failed.push(`${mode.id}/${scheme}/${sex}: wrong or no clip: ${JSON.stringify(video)}`);
    if (video && !video.inline) failed.push(`${mode.id}/${scheme}/${sex}: video not playsInline`);
    if (await page.getByText('Protótipo').count())
      failed.push(`${mode.id}/${scheme}/${sex}: prototype badge shows in the preview`);

    // The swap sheet.
    await page.getByText('Trocar', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: name('swap'), type: 'jpeg', quality: 70 });

    // The end of the first workout, then of a later one.
    await put([workout(0, LAST, true)]);
    await go(`/workout/${LAST}/done`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: name('done-first'), type: 'jpeg', quality: 70, fullPage: true });
    if (await page.getByText('Termine forte').count())
      failed.push(`${mode.id}/${scheme}/${sex}: "Termine forte" after the first workout`);
    await put([{ ...workout(-2, EARLIER, true), logs: [] }, workout(0, LAST, true)]);
    await go(`/workout/${LAST}/done`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: name('done-later'), type: 'jpeg', quality: 70, fullPage: true });

    // Package B screens: the workout menu, rest, the exercise page, plans,
    // equipment and the Body tab.
    const live = workout(0, LIVE, false);
    live.logs = [
      {
        itemId: 'i0',
        exerciseId: 'sit_to_stand',
        setNo: 1,
        reps: 10,
        loggedAt: `${day(0)}T09:10:00`,
      },
    ];
    await put([live]);
    await go(`/workout/${LIVE}/exit`);
    await page.screenshot({ path: name('menu'), type: 'jpeg', quality: 70 });
    await go(`/workout/${LIVE}/rest`);
    await page.screenshot({ path: name('rest'), type: 'jpeg', quality: 70 });
    for (const [shot, path] of [
      ['exercise', '/exercise/sit_to_stand'],
      ['plans', '/programs'],
      ['equipment', '/settings/equipment'],
      ['body', '/body'],
    ]) {
      await go(path);
      await page.screenshot({ path: name(shot), type: 'jpeg', quality: 70 });
    }

    await context.close();
  }
} finally {
  await browser.close();
  close();
}
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log(`phone-test screenshots in ${out}`);
