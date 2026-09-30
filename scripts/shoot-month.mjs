// Phase 26: screenshots of the "Month closed" screen and the Home card in
// en / es / pt-BR (docs/screenshots/month/). Seeds a profile with a full
// month of workouts that ended yesterday, opens Home (which opens /month
// once), then skips to see the Home card.
// Run: node scripts/shoot-month.mjs  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';

const seed = JSON.parse(readFileSync(new URL('../supabase/seed/exercises.json', import.meta.url)));
const pick = (f) => seed.exercises.find(f);
const squat = pick((e) => e.pattern === 'squat' && e.loaded && e.parts?.includes('main'));
const bench = pick(
  (e) => e.pattern === 'horizontal_push' && e.loaded && e.parts?.includes('main') && !e.isolation,
);
const row = pick((e) => e.pattern === 'horizontal_pull' && e.loaded && e.parts?.includes('main'));
// Seed rows: muscles are [key, role, emphasis]; the app's id is the slug.
const topMuscle = (e) => (e.muscles ?? []).find((m) => m[1] === 'primary')?.[0] ?? null;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
// A 4-week block that ended yesterday: 8 workouts, loads going up.
const workouts = [-28, -25, -21, -18, -14, -11, -7, -4].map((o, i) => {
  const date = day(o);
  const moves = [
    { e: squat, load: 60 + i * 2.5 },
    { e: bench, load: 40 },
    { e: row, load: 35 + i },
  ];
  return {
    id: `w-${date}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:50:00`,
    status: 'done',
    session: {
      items: moves.map((m, n) => ({
        id: `i${n}`,
        role: 'main',
        part: 'main',
        exerciseId: m.e.slug,
        targetMuscle: topMuscle(m.e),
        goal: 'grow',
        sets: 3,
        reps: [8, 12],
        restSeconds: 90,
        perSide: false,
        loadHint: null,
        estSeconds: 300,
      })),
      minutes: 50,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 50,
      notes: [],
    },
    logs: moves.flatMap((m, n) =>
      [1, 2, 3].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: m.e.slug,
        setNo,
        reps: 10,
        load: m.load,
        unit: 'kg',
        loggedAt: `${date}T09:${10 + setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
});

const out = join(process.cwd(), 'docs', 'screenshots', 'month');
mkdirSync(out, { recursive: true });
const dir = process.env.THEME_EXPORT_DIR ?? mkdtempSync(join(tmpdir(), 'month-'));
if (!process.env.THEME_EXPORT_DIR) exportWeb(dir);
const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });
const failed = [];
try {
  for (const locale of ['en', 'es', 'pt-BR']) {
    // Tall enough for the whole scrollable screen in one picture.
    const context = await browser.newContext({
      viewport: { width: 390, height: 3200 },
      locale,
      deviceScaleFactor: 1,
    });
    const entries = {
      onboarding: JSON.stringify(
        profile(1988, true, {
          locale,
          muscleGoals: [
            { muscleKey: 'quads', goal: 'grow' },
            { muscleKey: 'hamstrings', goal: 'grow' },
          ],
        }),
      ),
      workouts: JSON.stringify({ state: { workouts }, version: 2 }),
    };
    await context.addInitScript((e) => {
      if (!sessionStorage.getItem('seeded')) {
        for (const [k, v] of Object.entries(e)) localStorage.setItem(`tapstrong\\${k}`, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, entries);
    const page = await context.newPage();
    await page.goto(`${origin}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if (!new URL(page.url()).pathname.startsWith('/month'))
      failed.push(`${locale}: Home did not open /month (${page.url()})`);
    await page.screenshot({ path: join(out, `${locale}-month.jpg`), type: 'jpeg', quality: 70 });
    // Skip: the summary becomes a Home card for 7 days.
    const skip = { en: 'Skip', es: 'Saltar', 'pt-BR': 'Pular' }[locale];
    await page.getByRole('button', { name: skip, exact: true }).first().click();
    await page.goto(`${origin}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const card = page.getByTestId('month-home-card');
    if (!(await card.count())) failed.push(`${locale}: no Home card after Skip`);
    else await card.scrollIntoViewIfNeeded();
    await page.setViewportSize({ width: 390, height: 1400 });
    await page.screenshot({
      path: join(out, `${locale}-home-card.jpg`),
      type: 'jpeg',
      quality: 70,
    });
    await context.close();
  }
} finally {
  await browser.close();
  close();
}
if (failed.length) {
  console.error(`shoot-month failed:\n- ${failed.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: month screenshots in ${out}`);
