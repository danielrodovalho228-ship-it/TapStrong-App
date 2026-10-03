// Phase 31 (the reference flow): My plan, the swap sheet, the warm-up, the set
// logger with rest, the exercise detail, the end, the Exercises tab (body and
// a muscle grid), the Library, Library equipment, Progress (Activity, Body)
// and Settings — teen, adult and 60+, dark by default (plus adult light), as
// the preview link builds them (EXPO_PUBLIC_DEMO_MEDIA=1). It also checks that
// no text sits on the player's media frame.
// Output: <out>/<mode>-<scheme>-<name>.jpg (default docs/screenshots/p31)
// Run: node scripts/shoot-p31.mjs [exportDir] [outDir]
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, profile, serve } from './lib/web.mjs';

const [givenDir, givenOut] = process.argv.slice(2);
const out = givenOut ?? join(process.cwd(), 'docs', 'screenshots', 'p31');
mkdirSync(out, { recursive: true });
const dir = givenDir ?? mkdtempSync(join(tmpdir(), 'p31-'));
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
const MOVES = [
  ['dumbbell_curl', 'biceps'],
  ['dumbbell_lateral_raise', 'shoulders'],
];
const main = (slug, n, muscle) => ({
  id: `i${n}`,
  role: 'main',
  part: 'main',
  exerciseId: slug,
  targetMuscle: muscle,
  goal: 'grow',
  sets: 4,
  reps: [10, 12],
  restSeconds: 90,
  perSide: false,
  loadHint: null,
  estSeconds: 300,
});
const warm = {
  id: 'w0',
  role: 'warmup',
  part: 'warmup_general',
  exerciseId: 'march_in_place',
  targetMuscle: null,
  goal: null,
  sets: 1,
  durationSeconds: 120,
  restSeconds: 0,
  perSide: false,
  loadHint: null,
  estSeconds: 120,
};
const workout = (offset, id, { done = false, warmup = false, logged = 0 } = {}) => {
  const date = day(offset);
  // A live workout started 12 minutes ago, so the clock reads like one.
  const started = done ? `${date}T09:00:00` : new Date(Date.now() - 12 * 60_000).toISOString();
  return {
    id,
    kind: 'regular',
    createdAt: started,
    startedAt: started,
    endedAt: done ? `${date}T09:40:00` : undefined,
    status: done ? 'done' : 'active',
    session: {
      items: [...(warmup ? [warm] : []), ...MOVES.map(([slug, m], n) => main(slug, n, m))],
      minutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 40,
      notes: [],
    },
    logs: MOVES.flatMap(([slug], n) =>
      [1, 2, 3, 4]
        .filter((setNo) => done || (n === 0 && setNo <= logged))
        .map((setNo) => ({
          itemId: `i${n}`,
          exerciseId: slug,
          setNo,
          reps: 12,
          load: 8 + (done ? 0 : 1),
          unit: 'kg',
          loggedAt: `${date}T09:${10 + n * 10 + setNo}:00`,
        })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
};
const IDS = {
  past: '00000000-0000-4000-8000-000000000311',
  live: '00000000-0000-4000-8000-000000000312',
  warm: '00000000-0000-4000-8000-000000000313',
};

const MODES = [
  { id: 'teen', year: new Date().getFullYear() - 15 },
  { id: 'adult', year: 1988 },
  { id: 'senior', year: 1956 },
];
const RUNS = [
  ...MODES.map((m) => ({ mode: m, scheme: 'dark' })),
  { mode: MODES[1], scheme: 'light' },
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

/** Text boxes that overlap the media frame (the dev badge aside). */
const overlaps = (page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-testid="demo-frame"]');
    if (!frame) return [];
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
  for (const { mode, scheme } of RUNS) {
    const name = (n) => join(out, `${mode.id}-${scheme}-${n}.jpg`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
      deviceScaleFactor: 1,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    const put = async (workouts) => {
      await page.evaluate(
        ([p, w, a]) => {
          localStorage.setItem('tapstrong\\onboarding', p);
          localStorage.setItem('tapstrong\\workouts', w);
          localStorage.setItem('tapstrong\\appearance', a);
        },
        [
          JSON.stringify(
            profile(mode.year, true, {
              locale: 'pt-BR',
              sex: 'f',
              location: 'gym',
              minutes: 40,
              equipment: ['dumbbells', 'flat_bench', 'adjustable_bench', 'barbell', 'cables'],
              muscleGoals: [{ muscleKey: 'biceps', goal: 'grow' }],
            }),
          ),
          JSON.stringify({ state: { workouts }, version: 2 }),
          JSON.stringify({ state: { appearance: scheme }, version: 2 }),
        ],
      );
    };
    const go = async (path) => {
      await page.goto(`${origin}${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(1800);
      if (mode.id === 'teen') await liftGate(page);
    };
    const shot = (n, fullPage = false) =>
      page.screenshot({ path: name(n), type: 'jpeg', quality: 70, fullPage });
    await page.goto(`${origin}/`, { waitUntil: 'load' });

    // My plan (generated) and the swap sheet.
    await put([workout(-3, IDS.past, { done: true })]);
    await go('/home');
    await shot('01-plan', true);
    const swap = page.locator('[data-testid="plan-card-swap"]').first();
    if (await swap.count()) {
      await swap.click();
      await page.waitForTimeout(1200);
      await shot('02-swap');
    }

    // The warm-up, full screen.
    await put([workout(-3, IDS.past, { done: true }), workout(0, IDS.warm, { warmup: true })]);
    await go(`/workout/${IDS.warm}/play`);
    await shot('03-warmup');
    const o = await overlaps(page);
    if (o.length) failed.push(`${mode.id}/${scheme} warm-up: text on media: ${o}`);

    // The set logger with two sets done, then rest over it.
    await put([workout(-3, IDS.past, { done: true }), workout(0, IDS.live, { logged: 2 })]);
    await go(`/workout/${IDS.live}/play`);
    await shot('04-logger', true);
    await go(`/workout/${IDS.live}/rest`);
    await shot('05-rest');
    await go(`/workout/${IDS.live}/exit`);
    await shot('06-menu');

    // The exercise detail and the end.
    await go(`/exercise/${MOVES[0][0]}`);
    await shot('07-detail', true);
    await put([workout(-3, IDS.past, { done: true }), workout(0, IDS.live, { done: true })]);
    await go(`/workout/${IDS.live}/done`);
    await page.waitForTimeout(1500);
    await shot('08-done', true);

    // Exercises tab, a muscle grid, the Library, its equipment, Progress, Settings.
    for (const [n, path, full] of [
      ['09-exercises', '/body', true],
      ['10-muscle', '/muscle/biceps', false],
      ['11-library', '/library', true],
      ['12-equipment', '/library-equipment', false],
      ['13-progress', '/progress', true],
      ['15-settings', '/settings', true],
    ]) {
      await go(path);
      await shot(n, full);
      if (n === '13-progress') {
        const body = page.getByRole('radio', { name: 'Corpo' });
        if (await body.count()) {
          await body.click();
          await page.waitForTimeout(1200);
          await shot('14-progress-body', true);
        }
      }
    }
    if ((await page.getByText(/kcal|caloria/i).count()) > 0)
      failed.push(`${mode.id}/${scheme}: calories on Settings`);

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
console.log(`Phase 31 screenshots in ${out}`);
