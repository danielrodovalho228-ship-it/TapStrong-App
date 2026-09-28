// QA R5-07: proves the bottom tab labels are never clipped on web.
// Exports the web build, serves it, opens /home at 390×844 in Chromium and
// checks that every tab label box is at least as tall as its text and that
// no ancestor clips it. Saves a screenshot next to the report.
// Run: npm run tabs:check  (uses the Chromium in PLAYWRIGHT_BROWSERS_PATH)
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

import { chromium } from 'playwright-core';

const out = mkdtempSync(join(tmpdir(), 'tabs-'));
const shot = process.env.TABS_SCREENSHOT ?? join(process.cwd(), 'docs', 'tab-labels.png');
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const executablePath = [
  join(browsers, 'chromium'),
  join(browsers, 'chromium-1194', 'chrome-linux', 'chrome'),
].find((p) => existsSync(p) && statSync(p).isFile());

execSync(`npx expo export --platform web --output-dir ${out}`, {
  stdio: 'ignore',
  env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' },
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const candidates = [join(out, path), join(out, `${path}.html`), join(out, path, 'index.html')];
  const file = candidates.find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath });
let failed = [];
try {
  // The static HTML is what paints first; JS off keeps the page from
  // redirecting to onboarding before we measure.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await page.goto(`http://localhost:${port}/home`);
  const labels = await page.$$eval('[data-testid="tab-label"]', (els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      const clippedBy = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflow !== 'visible' && p.getBoundingClientRect().height < box.height - 0.5)
          clippedBy.push(p.tagName);
      }
      return {
        text: el.textContent,
        height: box.height,
        textHeight: el.scrollHeight,
        width: box.width,
        textWidth: el.scrollWidth,
        clippedBy,
      };
    }),
  );
  if (labels.length < 4) failed.push(`found ${labels.length} tab labels`);
  for (const l of labels) {
    if (l.height + 0.5 < l.textHeight) failed.push(`${l.text}: box ${l.height}px < text ${l.textHeight}px`);
    if (l.width + 0.5 < l.textWidth) failed.push(`${l.text}: box ${l.width}px < text ${l.textWidth}px wide`);
    if (l.clippedBy.length) failed.push(`${l.text}: clipped by ${l.clippedBy.join(' > ')}`);
  }
  await page.screenshot({ path: shot, clip: { x: 0, y: 844 - 90, width: 390, height: 90 } });
  console.log(labels.map((l) => `${l.text} ${l.width.toFixed(0)}×${l.height.toFixed(0)}`).join(', '));
} finally {
  await browser.close();
  server.close();
  rmSync(out, { recursive: true, force: true });
}
if (failed.length) {
  console.error(`FAIL: ${failed.join('; ')}`);
  process.exit(1);
}
console.log(`OK: tab labels fit (screenshot: ${shot})`);
