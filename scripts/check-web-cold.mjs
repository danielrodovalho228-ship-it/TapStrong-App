// QA R8-04: on the static web export, a screen opened directly by URL must
// show the saved answers, never the defaults (Continue would save them).
// Exports the web build, serves it, seeds a profile the way the app stores it,
// cold-loads the edit screens and checks what they show and save.
// Run: npm run web:check  (THEME_EXPORT_DIR=<dir> reuses a web export)
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { executablePath, exportWeb, profile, serve } from './lib/web.mjs';
import { cspProblems, hashOf, headerPolicy, inlineScripts, writeHeaders } from './web-headers.mjs';

const reuse = process.env.THEME_EXPORT_DIR;
const out = reuse ?? mkdtempSync(join(tmpdir(), 'cold-'));
if (!reuse) exportWeb(out);
const { origin, close } = await serve(out);

const browser = await chromium.launch({ executablePath });
const failed = [];
const cspViolations = [];
const pressed = (page, name) =>
  page
    .getByRole('button', { name, exact: true })
    .first()
    .getAttribute('aria-pressed')
    .catch(() => null);

async function coldPage(extra, birthYear = 1990) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seed = JSON.stringify(profile(birthYear, true, extra));
  await context.addInitScript((v) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('tapstrong\\onboarding', v);
      sessionStorage.setItem('seeded', '1');
    }
  }, seed);
  const page = await context.newPage();
  // Security round 1, S2-06: nothing the page needs may be blocked by its CSP.
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text().slice(0, 200));
  });
  return { context, page };
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('tapstrong\\onboarding')).state);

try {
  // Safety check, edit mode.
  {
    const { context, page } = await coldPage({
      painAreas: ['knee'],
      conditions: ['diabetes'],
      position: 'with_support',
    });
    await page.goto(`${origin}/onboarding/safety?edit=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    for (const name of ['Knee', 'Diabetes / prediabetes', 'With support'])
      if ((await pressed(page, name)) !== 'true')
        failed.push(`safety: "${name}" not shown selected`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForTimeout(500);
    const s = await stored(page);
    if (JSON.stringify(s.painAreas) !== '["knee"]' || s.position !== 'with_support')
      failed.push(`safety: Continue saved ${JSON.stringify([s.painAreas, s.position])}`);
    await context.close();
  }
  // Who, edit mode: the saved birth date is shown, not "—".
  {
    const { context, page } = await coldPage({});
    await page.goto(`${origin}/onboarding/who?edit=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => document.body.innerText);
    if (!text.includes('1990')) failed.push('who: saved birth year not shown');
    await context.close();
  }
  // Security round 2, S2-P2-1: a teen typing an address still gets only the
  // note on the web; the account and the birth-date fix stay reachable.
  {
    const TEEN_NOTE = 'tapstrong for teens is in the mobile app';
    const teenYear = new Date().getFullYear() - 15;
    for (const path of ['/settings', '/workout/new', '/restrictions', '/programs', '/home']) {
      const { context, page } = await coldPage({}, teenYear);
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      // innerText follows the title's uppercase style: compare without case.
      const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      if (!text.includes(TEEN_NOTE)) failed.push(`teen on the web: ${path} opened the app`);
      await context.close();
    }
    const { context, page } = await coldPage({}, teenYear);
    await page.goto(`${origin}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    if ((await page.evaluate(() => document.body.innerText)).toLowerCase().includes(TEEN_NOTE))
      failed.push('teen on the web: /account is blocked (it must stay reachable)');
    await context.close();
  }
  // R8-04: clock-based text renders only after hydration, so the static HTML
  // carries no build-day date (no #418 the day after a build).
  const DATE =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\d{4}-\d{2}-\d{2}T/;
  for (const path of ['/home', '/plans', '/paywall', '/progress']) {
    const html = await (await fetch(`${origin}${path}`)).text();
    const body = html.slice(html.indexOf('<body'));
    const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    const hit = text.match(DATE);
    if (hit) failed.push(`${path}: static HTML shows a date ("${hit[0]}")`);
  }
  // S2-06: every page's CSP lists exactly the hashes of its inline scripts,
  // and the host header files carry the same policy plus frame-ancestors.
  for (const path of ['/home', '/plans', '/account', '/onboarding/who']) {
    const html = await (await fetch(`${origin}${path}`)).text();
    let policy = '';
    try {
      policy = headerPolicy(html);
    } catch {
      failed.push(`${path}: no Content-Security-Policy meta tag`);
      continue;
    }
    for (const s of inlineScripts(html))
      if (!policy.includes(hashOf(s)))
        failed.push(
          `${path}: inline script not allowed by the CSP hash list ("${s.slice(0, 40)}…")`,
        );
    const listed = policy.match(/'sha256-[^']+'/g) ?? [];
    if (listed.length !== inlineScripts(html).length)
      failed.push(
        `${path}: CSP lists ${listed.length} hashes for ${inlineScripts(html).length} inline scripts`,
      );
  }
  const headers = writeHeaders(out);
  if (!/frame-ancestors 'none'/.test(headers['Content-Security-Policy']))
    failed.push('host headers: no frame-ancestors');
  if (cspViolations.length) failed.push(`CSP blocked something: ${cspViolations[0]}`);
} finally {
  await browser.close();
  close();
}

// Round 2, P3: the same CSP check on the production export, every page.
if (!process.env.WEB_CHECK_SKIP_RELEASE) {
  const release = mkdtempSync(join(tmpdir(), 'release-'));
  exportWeb(release, { release: true });
  for (const p of cspProblems(release)) failed.push(`release export: ${p}`);
  const h = writeHeaders(release);
  if (/preload|includeSubDomains/.test(h['Strict-Transport-Security']))
    failed.push('release headers: HSTS preload / includeSubDomains before the domain is decided');
}

if (failed.length) {
  console.error(`web:check failed:\n- ${failed.join('\n- ')}`);
  process.exit(1);
}
console.log(
  'web:check passed: cold-loaded edit screens show and keep the saved answers; no build-day dates in the static HTML; CSP hashes match the inline scripts (dev and release exports) and nothing was blocked',
);
