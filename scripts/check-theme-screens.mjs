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

/**
 * Every visible text on the page against the background it sits on
 * (semi-transparent layers composited). WCAG AA: 4.5:1, or 3:1 for large
 * text (24 px, or 18.66 px bold). Disabled or faded parts (opacity < 1) are
 * exempt, as are texts over images.
 */
async function contrastAudit(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const over = (top, under) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
    };
    const fails = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      if (
        el.checkVisibility &&
        !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      )
        continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      let faded = false;
      for (let p = el; p; p = p.parentElement)
        if (Number(getComputedStyle(p).opacity) < 1) faded = true;
      // What is painted under the text's middle, top to bottom: siblings
      // drawn behind it count too (captions over the body card).
      let image = false;
      const layers = [];
      const cx = Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1);
      const cy = Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1);
      const inView = box.bottom > 0 && box.top < innerHeight;
      const stack = inView ? document.elementsFromPoint(cx, cy) : [];
      const opaque = (p) => {
        const cs = getComputedStyle(p);
        const bg = parse(cs.backgroundColor);
        return p.tagName === 'IMG' || cs.backgroundImage !== 'none' || (bg && bg[3] >= 1);
      };
      let chain;
      const at = stack.indexOf(el);
      if (!inView) {
        chain = [];
        for (let p = el.parentElement; p; p = p.parentElement) chain.push(p);
      } else if (at >= 0) {
        // Something opaque painted over the text hides it (a sheet, a footer).
        const above = stack.slice(0, at).filter((p) => !el.contains(p));
        if (above.some(opaque)) continue;
        chain = stack.slice(at + 1);
      } else if (getComputedStyle(el).pointerEvents === 'none') {
        chain = stack.filter((p) => !el.contains(p));
      } else {
        continue;
      }
      const ownBg = parse(getComputedStyle(el).backgroundColor);
      if (ownBg && ownBg[3] > 0) chain.unshift(el);
      for (const p of chain) {
        const cs = getComputedStyle(p);
        if (p.tagName === 'IMG' || cs.backgroundImage !== 'none') {
          image = true;
          break;
        }
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) {
          layers.push(bg);
          if (bg[3] >= 1) break;
        }
      }
      if (faded || image) continue;
      let bg = [255, 255, 255, 1];
      for (const layer of layers.reverse()) bg = over(layer, bg);
      const cs = getComputedStyle(el);
      let fg = parse(cs.color);
      if (!fg) continue;
      if (fg[3] < 1) fg = over(fg, bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700 || /Bold|SemiBold|Condensed/.test(cs.fontFamily);
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const r = ratio(fg, bg);
      const text = el.textContent.trim().slice(0, 30);
      const key = `${text}|${cs.color}|${bg.join(',')}`;
      if (r + 0.01 < need && !seen.has(key)) {
        seen.add(key);
        fails.push(
          `"${text}" ${r.toFixed(2)}:1 (${cs.color} on rgb(${bg.slice(0, 3).map(Math.round).join(', ')}))`,
        );
      }
    }
    return fails;
  });
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
  {
    name: 'swap-undo',
    year: ADULT,
    path: '/home',
    steps: async (page) => {
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      await button(page, /^Swap /).click();
      await page.waitForTimeout(400);
      await button(page, /^Replace/).click();
      await page.getByRole('button', { name: 'Undo' }).waitFor();
    },
    lands: /^\/workout\/[^/]+$/,
  },
  {
    name: 'restrictions',
    year: ADULT,
    path: '/restrictions',
    seed: {
      restrictions: {
        items: [
          {
            id: 'r1',
            area: 'knee',
            side: 'left',
            source: 'pain_report',
            active: true,
            createdAt: '2026-09-20T12:00:00Z',
          },
          {
            id: 'r2',
            area: 'lower_back',
            source: 'manual',
            active: true,
            createdAt: '2026-09-21T12:00:00Z',
          },
        ],
      },
    },
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
        const seed = { onboarding: JSON.stringify(profile(year, screen.complete ?? true)) };
        for (const [key, state] of Object.entries(screen.seed ?? {}))
          seed[key] = JSON.stringify({ state, version: 2 });
        await context.addInitScript((entries) => {
          if (!sessionStorage.getItem('seeded')) {
            for (const [key, v] of Object.entries(entries))
              localStorage.setItem(`tapstrong\\${key}`, v);
            sessionStorage.setItem('seeded', '1');
          }
        }, seed);
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
        for (const f of await contrastAudit(page)) failed.push(`${scheme} ${name}: contrast ${f}`);
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
  // QA R6-01: the phone flips to dark mid-workout. The player keeps its
  // route and step, and repaints dark without a reload.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
      deviceScaleFactor: 1,
    });
    const value = JSON.stringify(profile(ADULT, true));
    await context.addInitScript((v) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('tapstrong\\onboarding', v);
        sessionStorage.setItem('seeded', '1');
      }
    }, value);
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/home`, { waitUntil: 'networkidle' });
      await button(page, /^Start · /).click();
      await page.waitForURL(/\/workout\/[^/]+$/);
      await button(page, 'Start with warm-up').click();
      await page.waitForURL(/\/play$/);
      await page.waitForTimeout(500);
      const before = new URL(page.url()).pathname;
      const step = await page.locator('[role="heading"]:visible').last().textContent();
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(800);
      const after = new URL(page.url()).pathname;
      const stepAfter = await page.locator('[role="heading"]:visible').last().textContent();
      const seen = await pixel(page, 2, 422);
      if (after !== before) failed.push(`live switch: ${before} became ${after}`);
      if (stepAfter !== step) failed.push(`live switch: step "${step}" became "${stepAfter}"`);
      if (seen !== PALETTE_BG.dark) failed.push(`live switch: background ${seen} after going dark`);
      done.push(`live switch: ${after} "${stepAfter}" ${seen}`);
    } catch (e) {
      failed.push(`live switch: ${String(e.message ?? e).split('\n')[0]}`);
    }
    await context.close();
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
