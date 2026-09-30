// Phase 27 ("the 3 S"): screenshots of Home, the player, the end screen with
// the map lighting up (3 frames) and 3 Moments, in teen, adult and 60+ mode
// and in en / es / pt-BR (docs/screenshots/three-s/<mode>/<locale>-*.jpg).
//
// Teens are app-only on the web (Phase 24): for their pictures this harness
// lifts the web gate in the page after it renders. The app itself still
// blocks them on the web.
// Run: node scripts/shoot-three-s.mjs  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';

const seed = JSON.parse(readFileSync(new URL('../supabase/seed/exercises.json', import.meta.url)));
const pick = (f) => seed.exercises.find(f);
const squat = pick((e) => e.pattern === 'squat' && e.parts?.includes('main') && !e.loaded);
const row = pick((e) => e.pattern === 'horizontal_pull' && e.parts?.includes('main') && !e.loaded);
const primary = (e) => (e.muscles ?? []).find((m) => m[1] === 'primary')?.[0] ?? null;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const workout = (offset, id) => {
  const date = day(offset);
  const moves = [squat, row];
  return {
    id,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:42:00`,
    status: 'done',
    session: {
      items: moves.map((e, n) => ({
        id: `i${n}`,
        role: 'main',
        part: 'main',
        exerciseId: e.slug,
        targetMuscle: primary(e),
        goal: 'grow',
        sets: 3,
        reps: [8, 12],
        restSeconds: 60,
        perSide: false,
        loadHint: null,
        estSeconds: 300,
      })),
      minutes: 42,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 42,
      notes: [],
    },
    logs: moves.flatMap((e, n) =>
      [1, 2, 3].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: e.slug,
        setNo,
        reps: 10,
        loggedAt: `${date}T09:${10 + n * 5 + setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
};

// The last workout ended today; two earlier this week.
const LAST = '00000000-0000-4000-8000-000000000027';
const history = [
  workout(-2, '00000000-0000-4000-8000-000000000001'),
  workout(-1, '00000000-0000-4000-8000-000000000002'),
];
const last = workout(0, LAST);

const MODES = [
  { id: 'teen', year: new Date().getFullYear() - 15 },
  { id: 'adult', year: 1988 },
  { id: 'senior', year: 1956 },
];
const LOCALES = ['en', 'es', 'pt-BR'];

/** Three Moments per mode (minors only get habit, curiosity and map ones). */
const moment = (id, kind, params, extra = {}) => ({
  rowId: `row-${id}`,
  id,
  kind,
  at: `${day(0)}T09:45:00.000Z`,
  workoutId: LAST,
  answer: null,
  params,
  ...extra,
});
const MOMENTS = {
  teen: [
    moment('workouts:10', 'milestone_workouts', { count: 10 }),
    moment('fact:f01', 'fact', { fact: 'f01' }, { muscles: ['glutes'] }),
    moment('map_new:lats', 'map_new_muscle', { muscle: 'lats' }, { muscles: ['lats'] }),
  ],
  adult: [
    moment('workouts:25', 'milestone_workouts', { count: 25 }),
    moment('fact:f09', 'fact', { fact: 'f09' }, { muscles: ['lats'] }),
    moment('coach_pain:x', 'coach_pain', { area: 'knee' }, { asks: true }),
  ],
  senior: [
    moment('workouts:10', 'milestone_workouts', { count: 10 }),
    moment('fact:f02', 'fact', { fact: 'f02' }, { muscles: ['glutes'] }),
    moment('map_new:quads', 'map_new_muscle', { muscle: 'quads' }, { muscles: ['quads'] }),
  ],
};

const out = join(process.cwd(), 'docs', 'screenshots', 'three-s');
const dir = process.env.THEME_EXPORT_DIR ?? mkdtempSync(join(tmpdir(), 'three-s-'));
if (!process.env.THEME_EXPORT_DIR) exportWeb(dir);
const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });
const failed = [];

/** Teens: lift the web-only gate so the app screen underneath can be seen. */
async function liftGate(page) {
  await page.evaluate(() => {
    const gate = document.querySelector('[data-testid="web-family-gate"]');
    if (!gate) return;
    const app = gate.previousElementSibling;
    gate.remove();
    if (app) app.style.display = 'flex';
  });
}

try {
  for (const mode of MODES) {
    mkdirSync(join(out, mode.id), { recursive: true });
    for (const locale of LOCALES) {
      const shot = (name) => join(out, mode.id, `${locale}-${name}.jpg`);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale,
        deviceScaleFactor: 1,
        reducedMotion: 'no-preference',
      });
      const state = (workouts, moments = []) => ({
        onboarding: JSON.stringify(
          profile(mode.year, true, {
            locale,
            sex: 'f',
            daysPerWeek: 3,
            muscleGoals: [{ muscleKey: 'glutes', goal: 'grow' }],
          }),
        ),
        workouts: JSON.stringify({ state: { workouts }, version: 2 }),
        moments: JSON.stringify({ state: { shown: moments }, version: 1 }),
      });
      let entries = state(history);
      // Seed once per tab; later steps write their own data before loading.
      await context.addInitScript((getEntries) => {
        if (sessionStorage.getItem('seeded')) return;
        const e = JSON.parse(getEntries);
        for (const [k, v] of Object.entries(e)) localStorage.setItem(`tapstrong\\${k}`, v);
        sessionStorage.setItem('seeded', '1');
      }, JSON.stringify(entries));
      const page = await context.newPage();
      const open = async (path, entriesNow) => {
        await page.evaluate((e) => {
          for (const [k, v] of Object.entries(e)) localStorage.setItem(`tapstrong\\${k}`, v);
        }, entriesNow);
        await page.goto(`${origin}${path}`, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        if (mode.id === 'teen') await liftGate(page);
      };

      // Home: the one big button at the top.
      await page.goto(`${origin}/home`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      if (mode.id === 'teen') await liftGate(page);
      if (!(await page.locator('[data-testid="start-hero"]').count()))
        failed.push(`${mode.id} ${locale}: no big Start on Home`);
      await page.screenshot({ path: shot('home'), type: 'jpeg', quality: 70 });

      // The player: one tap from Home.
      await page.locator('[data-testid="start-hero"]').first().click();
      await page.waitForTimeout(1500);
      if (mode.id === 'teen') await liftGate(page);
      if (!page.url().includes('/play'))
        failed.push(`${mode.id} ${locale}: Home did not open the player (${page.url()})`);
      await page.screenshot({ path: shot('player'), type: 'jpeg', quality: 70 });

      // The end screen: the map lights up (3 frames).
      entries = state([...history, last]);
      await page.evaluate((e) => {
        for (const [k, v] of Object.entries(e)) localStorage.setItem(`tapstrong\\${k}`, v);
      }, entries);
      await page.goto(`${origin}/workout/${LAST}/done`, { waitUntil: 'load' });
      if (mode.id === 'teen') await liftGate(page);
      const body = page
        .locator('[data-testid="light-up-running"], [data-testid="light-up-done"]')
        .first();
      const frames = [250, 500, 2500];
      let waited = 0;
      for (const [n, at] of frames.entries()) {
        await page.waitForTimeout(at - waited);
        waited = at;
        if (mode.id === 'teen') await liftGate(page);
        if (await body.count())
          await body.screenshot({ path: shot(`light-${n + 1}`), type: 'jpeg', quality: 70 });
        else failed.push(`${mode.id} ${locale}: no light-up body`);
      }

      // Three Moments on the end screen.
      for (const [n, m] of MOMENTS[mode.id].entries()) {
        await open(`/workout/${LAST}/done`, state([...history, last], [m]));
        const card = page.locator(`[data-testid="moment-${m.kind}"]`).first();
        if (!(await card.count())) {
          failed.push(`${mode.id} ${locale}: Moment ${m.kind} not shown`);
          continue;
        }
        await card.scrollIntoViewIfNeeded();
        await card.screenshot({ path: shot(`moment-${n + 1}`), type: 'jpeg', quality: 75 });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  close();
}
if (failed.length) {
  console.error(`shoot-three-s failed:\n- ${failed.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: Phase 27 screenshots in ${out}`);
