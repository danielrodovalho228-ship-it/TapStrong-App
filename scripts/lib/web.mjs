// Shared by the web checks (theme:check, tabs:check): the Chromium path, a
// web export, a static server with dynamic routes, and a sample profile
// stored the way the app stores it on web.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
export const executablePath = [
  join(browsers, 'chromium'),
  join(browsers, 'chromium-1194', 'chrome-linux', 'chrome'),
].find((p) => existsSync(p) && statSync(p).isFile());

/** A development export: its sample library lets workout screens render offline. */
export function exportWeb(out) {
  execSync(`npx expo export --clear --dev --platform web --output-dir ${out}`, {
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
/** Serves an export; dynamic segments ("/exercise/abc") fall back to "[id]" pages. */
export async function serve(out) {
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
  return { origin: `http://localhost:${server.address().port}`, close: () => server.close() };
}

export const profile = (birthYear, complete, extra = {}) => ({
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
    ...extra,
  },
  version: 1,
});
