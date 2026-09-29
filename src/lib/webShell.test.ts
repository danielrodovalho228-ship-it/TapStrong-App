/**
 * QA R7-05: the web shell (+html.tsx: theme-color, color-scheme and the
 * background before the app loads) only runs with a static web export. A
 * local switch to "single" silently dropped it and dark loads flashed white.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

it('the web export stays static, so +html.tsx is used', () => {
  const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
  expect(app.expo.web.output).toBe('static');
  expect(existsSync(join(ROOT, 'src/app/+html.tsx'))).toBe(true);
  // No public/index.html template competing with it.
  expect(existsSync(join(ROOT, 'public/index.html'))).toBe(false);
});

it('the shell sends theme-color for both schemes and paints the background early', () => {
  const html = readFileSync(join(ROOT, 'src/app/+html.tsx'), 'utf8');
  expect(html).toMatch(/name="theme-color" media="\(prefers-color-scheme: light\)"/);
  expect(html).toMatch(/name="theme-color" media="\(prefers-color-scheme: dark\)"/);
  expect(html).toMatch(/name="color-scheme"/);
  expect(html).toMatch(/prefers-color-scheme: dark\)\{html,body\{background/);
});

it('the browser bar follows the saved Appearance, and a dark page waits for the app (QA R8 P2)', () => {
  const html = readFileSync(join(ROOT, 'src/app/+html.tsx'), 'utf8');
  expect(html).toMatch(/meta\[name="theme-color"\][\s\S]*setAttribute\('content'/);
  expect(html).not.toMatch(/setTimeout/);
  const gate = readFileSync(join(ROOT, 'src/features/appearance/ThemeGate.tsx'), 'utf8');
  expect(gate).toMatch(/meta\[name="theme-color"\]/);
});
