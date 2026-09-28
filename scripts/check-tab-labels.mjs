// QA R5-07, R6 P2: proves the bottom tab labels are never clipped on web, in
// English, Portuguese and Spanish, in Light and Dark. Exports the web build,
// serves it, opens /home at 390×844 in Chromium with a sample profile in each
// language and scheme, and checks that every tab label box is at least as
// tall and wide as its text, that no ancestor clips it, that the labels do
// not touch the bottom edge and that the page is not taller than the window.
// Saves one screenshot of the bar per language and scheme.
// Run: npm run tabs:check  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';

const shots = process.env.TABS_SCREENSHOTS ?? join(process.cwd(), 'docs', 'screenshots', 'tabs');
const reuse = process.env.THEME_EXPORT_DIR;
const out = reuse ?? mkdtempSync(join(tmpdir(), 'tabs-'));
if (!reuse) exportWeb(out);
const { origin, close } = await serve(out);
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ executablePath });
const failed = [];
const lines = [];
try {
  for (const locale of ['en', 'pt-BR', 'es']) {
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
        locale,
        deviceScaleFactor: 1,
      });
      const seed = JSON.stringify(profile(1990, true, { locale }));
      await context.addInitScript((v) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('tapstrong\\onboarding', v);
          sessionStorage.setItem('seeded', '1');
        }
      }, seed);
      const page = await context.newPage();
      await page.goto(`${origin}/home`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const found = await page.evaluate(() => {
        const labels = [...document.querySelectorAll('[data-testid="tab-label"]')]
          .filter((el) => el.checkVisibility?.() ?? true)
          .map((el) => {
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
              bottomGap: innerHeight - box.bottom,
              clippedBy,
            };
          });
        return {
          labels,
          pageHeight: document.documentElement.scrollHeight,
          viewport: innerHeight,
        };
      });
      const tag = `${locale}/${scheme}`;
      if (found.labels.length < 4) failed.push(`${tag}: found ${found.labels.length} tab labels`);
      if (found.pageHeight > found.viewport)
        failed.push(
          `${tag}: page ${found.pageHeight}px taller than the ${found.viewport}px window`,
        );
      for (const l of found.labels) {
        if (l.height + 0.5 < l.textHeight)
          failed.push(`${tag} ${l.text}: box ${l.height}px < text ${l.textHeight}px`);
        if (l.width + 0.5 < l.textWidth)
          failed.push(`${tag} ${l.text}: box ${l.width}px < text ${l.textWidth}px wide`);
        if (l.clippedBy.length)
          failed.push(`${tag} ${l.text}: clipped by ${l.clippedBy.join(' > ')}`);
        if (l.bottomGap < 4) failed.push(`${tag} ${l.text}: ${l.bottomGap}px from the bottom edge`);
      }
      await page.screenshot({
        path: join(shots, `${locale}-${scheme}.png`),
        clip: { x: 0, y: 844 - 90, width: 390, height: 90 },
      });
      lines.push(
        `${tag}: ${found.labels.map((l) => `${l.text} ${l.width.toFixed(0)}×${l.height.toFixed(0)}`).join(', ')}`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  close();
  if (!reuse) rmSync(out, { recursive: true, force: true });
}
console.log(lines.join('\n'));
if (failed.length) {
  console.error(`FAIL:\n${failed.join('\n')}`);
  process.exit(1);
}
console.log(`OK: tab labels fit in EN/PT/ES, light and dark (screenshots: ${shots})`);
