// Theme v2: renders the main screens in Light and Dark in Chromium and saves
// a screenshot per screen and mode under docs/screenshots/theme/<mode>/.
// Fails if a screen does not paint the palette's background in that mode,
// or if it lands on a different route than asked (a redirect).
// The app runs with JavaScript (it must, to follow the scheme); a sample
// adult or 60+ profile is written to local storage first, the way the app
// stores it on web.
// Run: npm run theme:check   (THEME_EXPORT_DIR=<dir> reuses a web export)
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

import { chromium } from 'playwright-core';

const PALETTE_BG = { light: 'rgb(250, 247, 244)', dark: 'rgb(21, 23, 27)' }; // #FAF7F4, #15171B
const HERO_BG = { light: 'rgb(42, 38, 35)', dark: 'rgb(38, 42, 48)' }; // dark.background
const shots = join(process.cwd(), 'docs', 'screenshots', 'theme');
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const executablePath = [
  join(browsers, 'chromium'),
  join(browsers, 'chromium-1194', 'chrome-linux', 'chrome'),
].find((p) => existsSync(p) && statSync(p).isFile());

const reuse = process.env.THEME_EXPORT_DIR;
const out = reuse ?? mkdtempSync(join(tmpdir(), 'theme-'));
if (!reuse) {
  // A development export: its sample library (draft exercises) lets the
  // workout screens render without a server.
  execSync(`npx expo export --dev --platform web --output-dir ${out}`, {
    stdio: 'ignore',
    env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' },
  });
}

// Static files; dynamic segments ("/exercise/abc") fall back to "[id]" pages.
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};
function resolve(dir, parts) {
  if (!parts.length) {
    const index = join(dir, 'index.html');
    return existsSync(index) ? index : null;
  }
  const [head, ...rest] = parts;
  const exact = join(dir, head);
  if (!rest.length) {
    for (const f of [exact, `${exact}.html`]) if (existsSync(f) && statSync(f).isFile()) return f;
  }
  if (existsSync(exact) && statSync(exact).isDirectory()) {
    const found = resolve(exact, rest);
    if (found) return found;
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  for (const name of readdirSync(dir)) {
    const group = name.startsWith('(') && statSync(join(dir, name)).isDirectory();
    if (group) {
      const found = resolve(join(dir, name), parts);
      if (found) return found;
    }
    if (!name.startsWith('[')) continue;
    const path = join(dir, name);
    if (!rest.length && name.endsWith('].html')) return path;
    if (statSync(path).isDirectory()) {
      const found = resolve(path, rest);
      if (found) return found;
    }
  }
  return null;
}
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const direct = join(out, path);
  const file =
    existsSync(direct) && statSync(direct).isFile()
      ? direct
      : resolve(out, path.split('/').filter(Boolean));
  if (!file) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const origin = `http://localhost:${server.address().port}`;

const profile = (birthYear, complete) => ({
  state: {
    units: 'metric',
    who: 'self',
    birthMonth: 5,
    birthYear,
    mainGoals: ['look'],
    location: 'gym',
    minutes: 45,
    daysPerWeek: 3,
    equipment: [],
    muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
    focusDeferred: false,
    sex: 'm',
    painAreas: [],
    conditions: [],
    position: 'standing',
    redFlagAcknowledged: false,
    chat: {},
    completedSteps: [],
    safetyDone: true,
    onboardingComplete: complete,
    bodyModel: {},
  },
  version: 1,
});

// Reads one screen pixel (a 1×1 PNG, filter byte + RGB(A)).
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, type: 'png' });
  let at = 8;
  const idat = [];
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    if (type === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const [, r, g, b] = inflateSync(Buffer.concat(idat));
  return `rgb(${r}, ${g}, ${b})`;
}

const button = (page, name) => page.getByRole('button', { name }).first();

/**
 * name, sample profile (birth year; null = none), route, optional steps to
 * reach the screen, the route it must end on, and where the page background
 * shows (x, y) with the token it must be.
 */
const ADULT = 1990;
const SENIOR = 1955;
const SCREENS = [
  { name: 'welcome', year: null, path: '/welcome' },
  { name: 'onboarding-chat', year: ADULT, complete: false, path: '/onboarding/chat' },
  { name: 'body-map', year: ADULT, path: '/body' },
  { name: 'goals', year: ADULT, path: '/goals?muscle=midChest', lands: '/goals' },
  { name: 'home', year: ADULT, path: '/home' },
  { name: 'home-60plus', year: SENIOR, path: '/home' },
  {
    name: 'workout-list',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
    },
    lands: /^\/workout\/[^/]+$/,
  },
  {
    name: 'swap-sheet',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      await button(page, /^Swap /).click();
      await page.waitForTimeout(500);
    },
    lands: /^\/workout\/[^/]+$/,
    background: null, // a sheet over the list
  },
  {
    name: 'player',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      await button(page, 'Start with warm-up').click();
      await page.waitForURL(/\/play$/);
    },
    lands: /\/play$/,
  },
  {
    name: 'rest',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      const id = new URL(page.url()).pathname.split('/')[2];
      await page.goto(`${origin}/workout/${id}/rest`);
    },
    lands: /\/rest$/,
    background: 'hero',
  },
  {
    name: 'done',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      const id = new URL(page.url()).pathname.split('/')[2];
      await page.goto(`${origin}/workout/${id}/done`);
    },
    lands: /\/done$/,
  },
  { name: 'library', year: ADULT, path: '/library' },
  {
    name: 'exercise',
    year: ADULT,
    path: '/library',
    steps: async (page) => {
      await page.locator('[role="button"]:has([data-testid="exercise-thumb"])').first().click();
      await page.waitForURL(/\/exercise\//);
    },
    lands: /^\/exercise\//,
  },
  { name: 'progress-activity', year: ADULT, path: '/progress' },
  {
    name: 'progress-body',
    year: ADULT,
    path: '/progress',
    steps: async (page) => {
      await page.getByRole('radio', { name: 'Body' }).first().click();
      await page.waitForTimeout(300);
    },
    lands: '/progress',
  },
  { name: 'plans', year: ADULT, path: '/plans' },
  { name: 'equipment', year: ADULT, path: '/settings/equipment' },
  { name: 'settings', year: ADULT, path: '/settings' },
  { name: 'appearance', year: ADULT, path: '/settings/appearance' },
  { name: 'family', year: ADULT, path: '/family' },
  { name: 'paywall', year: ADULT, path: '/paywall' },
  {
    name: 'parent-pin',
    year: ADULT,
    path: '/settings',
    steps: async (page) => {
      await button(page, /parent PIN/i).click();
      await page.waitForTimeout(400);
    },
    lands: '/settings',
    background: null, // shown as a card on Settings
  },
];

const browser = await chromium.launch({ executablePath });
const failed = [];
const done = [];
try {
  for (const scheme of ['light', 'dark']) {
    mkdirSync(join(shots, scheme), { recursive: true });
    for (const screen of SCREENS) {
      const { name, year, path } = screen;
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      if (year) {
        const value = JSON.stringify(profile(year, screen.complete ?? true));
        await context.addInitScript((v) => {
          if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem('tapstrong\\onboarding', v);
            sessionStorage.setItem('seeded', '1');
          }
        }, value);
      }
      const page = await context.newPage();
      try {
        await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        if (screen.steps) await screen.steps(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        const url = new URL(page.url()).pathname;
        const lands = screen.lands ?? path;
        const ok = lands instanceof RegExp ? lands.test(url) : url === lands;
        if (!ok) failed.push(`${scheme} ${name}: landed on ${url}`);
        const want =
          screen.background === undefined
            ? PALETTE_BG
            : screen.background === 'hero'
              ? HERO_BG
              : null;
        const seen = await pixel(page, 2, 422);
        if (want && seen !== want[scheme])
          failed.push(`${scheme} ${name}: background ${seen}, expected ${want[scheme]}`);
        await page.screenshot({
          path: join(shots, scheme, `${name}.jpg`),
          type: 'jpeg',
          quality: 70,
        });
        done.push(`${scheme}/${name}: ${url} ${seen}`);
      } catch (e) {
        failed.push(`${scheme} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  if (!reuse) rmSync(out, { recursive: true, force: true });
}
console.log(done.join('\n'));
if (failed.length) {
  console.error(`FAIL:\n${failed.join('\n')}`);
  process.exit(1);
}
console.log(`OK: ${done.length} screenshots in ${shots}`);
