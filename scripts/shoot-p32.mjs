// Phase 32 (Daniel's Android test): My plan, the shoulder program (and its
// settings), the safety questions, the warm-up and the player of a shoulder
// session — teen, adult and 60+, dark, pt-BR, at phone width (390 px). These
// are web renders of the same screens, not an Android device. Point it at an
// older export to shoot the "before" set with the same steps.
// Output: <out>/<mode>-<name>.jpg (default docs/screenshots/p32/after)
// Run: node scripts/shoot-p32.mjs [exportDir] [outDir]
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, profile, serve } from './lib/web.mjs';

const [rawDir, givenOut] = process.argv.slice(2);
const givenDir = rawDir || undefined;
const out = givenOut ?? join(process.cwd(), 'docs', 'screenshots', 'p32', 'after');
mkdirSync(out, { recursive: true });
const dir = givenDir ?? mkdtempSync(join(tmpdir(), 'p32-'));
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
const PROGRAM = 'shoulder_mobility_strength';
/** A finished stretch session of the program on that day (for the week squares). */
const stretchDay = (offset) => ({
  id: `00000000-0000-4000-8000-0000000032${10 + offset + 5}`,
  kind: 'repair',
  status: 'done',
  createdAt: `${day(offset)}T08:00:00`,
  startedAt: `${day(offset)}T08:00:00`,
  endedAt: `${day(offset)}T08:12:00`,
  session: {
    items: [],
    minutes: 10,
    warmupMinutes: 0,
    cooldownMinutes: 0,
    estimatedMinutes: 10,
    notes: [],
    program: { id: PROGRAM, session: 'stretch', week: 1 },
  },
  logs: [],
  skipped: [],
  swaps: [],
  pains: [],
});

// Adult: physio said yes (strengthening shows); teen and 60+: "not sure".
const MODES = [
  { id: 'teen', year: new Date().getFullYear() - 15, cleared: false, clearance: 'unsure' },
  { id: 'adult', year: 1985, cleared: true, clearance: 'yes' },
  { id: 'senior', year: 1956, cleared: false, clearance: 'unsure' },
];

const { origin, close } = await serve(dir);
const browser = await chromium.launch({ executablePath });

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
    const name = (n) => join(out, `${mode.id}-${n}.jpg`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'pt-BR',
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const put = async (withRun = true) => {
      await page.evaluate(
        ([p, w, r, a]) => {
          localStorage.setItem('tapstrong\\onboarding', p);
          localStorage.setItem('tapstrong\\workouts', w);
          localStorage.setItem('tapstrong\\appearance', a);
          if (r) localStorage.setItem('tapstrong\\rehab', r);
          else localStorage.removeItem('tapstrong\\rehab');
        },
        [
          JSON.stringify(
            profile(mode.year, true, {
              locale: 'pt-BR',
              sex: 'f',
              location: 'home',
              minutes: 30,
              equipment: ['dumbbells', 'resistance_band'],
            }),
          ),
          JSON.stringify({
            state: {
              workouts: [stretchDay(-2), stretchDay(-1)],
              streak: { current: 2, best: 2, freezes: 0, lastActive: day(-1), restDays: [] },
            },
            version: 2,
          }),
          withRun
            ? JSON.stringify({
                state: {
                  runs: {
                    [PROGRAM]: {
                      side: 'right',
                      startedAt: day(-2),
                      safetyAcceptedAt: new Date().toISOString(),
                      maintenance: false,
                      increased: {},
                      review: {},
                      cleared: mode.cleared,
                      clearance: mode.clearance,
                      releasedAt: null,
                      sleeperReminders: false,
                      fullDose: false,
                      strengthTiming: 'after',
                      rom: [
                        { date: day(-2), degrees: 75 },
                        { date: day(-1), degrees: 90 },
                      ],
                    },
                  },
                },
                version: 3,
              })
            : null,
          JSON.stringify({ state: { appearance: 'dark' }, version: 2 }),
        ],
      );
    };
    const go = async (path) => {
      await page.goto(`${origin}${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      if (mode.id === 'teen') await liftGate(page);
    };
    const shot = (n, fullPage = false) =>
      page.screenshot({ path: name(n), type: 'jpeg', quality: 70, fullPage });
    const tap = async (text) => {
      const el = page.getByText(text, { exact: true }).first();
      if (!(await el.count())) return false;
      await el.click();
      await page.waitForTimeout(1500);
      return true;
    };

    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await put();
    await go('/home');
    await shot('01-plan', true);
    await go(`/rehab/${PROGRAM}`);
    await shot('02-program', true);
    if (await tap('Ajustes do ombro')) await shot('03-program-settings', true);

    // The safety questions before the first session: nothing pre-selected.
    await put(false);
    await go(`/rehab/safety?id=${PROGRAM}&mode=start`);
    await shot('04-safety', true);

    // Session B (adult) starts with the warm-up; the others start today's stretches.
    await put();
    await go(`/rehab/${PROGRAM}`);
    if (mode.id === 'adult') {
      await tap('Ver detalhes');
      await tap('Começar a sessão B');
      await page.waitForTimeout(1500);
      await shot('05-warmup');
    } else {
      await tap('Começar sessão de hoje');
      await page.waitForTimeout(1500);
      await shot('05-player');
    }
    await context.close();
  }
} finally {
  await browser.close();
  close();
}
console.log(`Phase 32 screenshots in ${out}`);
