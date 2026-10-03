// Security round 1, permanent protections (docs/SECURITY.md). Fails when:
//  (c) a secret-looking key is in the tracked files, in git history, or in a
//      web export given with --bundle <dir>;
//  (d) an HTML / eval / script / WebView sink appears outside the audited
//      allowlist for that sink;
//  (e) a dependency in package.json isn't in package-lock.json with an
//      integrity hash;
//  (f) `npm audit --omit=dev` reports high or critical issues.
// The database side (RLS on every table, WITH CHECK on writes, SECURITY
// DEFINER with search_path and never anon) runs in `npm run db:test`
// (supabase/tests/local/zz_security_policies.sql).
//
// Usage: node scripts/security-check.mjs [--staged] [--bundle <dir>] [--no-history] [--offline]
//   --staged   pre-commit: only the lines being committed (secrets only)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const bundleDir = args.includes('--bundle') ? args[args.indexOf('--bundle') + 1] : null;
const failed = [];
const warnings = [];

const git = (...a) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });

// --- (c) secrets -------------------------------------------------------------
export const SECRET_PATTERNS = [
  ['Anthropic / OpenAI-style key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/],
  ['Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{10,}/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Webhook signing secret', /\bwhsec_[A-Za-z0-9+/=]{16,}/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

/** Secret findings in a text: [kind, excerpt]. A Supabase JWT counts only with role service_role. */
export function findSecrets(text) {
  const hits = [];
  for (const [kind, re] of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push([kind, `${m[0].slice(0, 12)}…`]);
  }
  for (const m of text.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role')
        hits.push(['Supabase service_role JWT', `${m[0].slice(0, 12)}…`]);
    } catch {
      // Not a JWT.
    }
  }
  return hits;
}

// Files that describe the patterns themselves.
const SECRET_ALLOW = new Set(['scripts/security-check.mjs', 'scripts/security-check.test.ts']);

function scanTracked() {
  for (const file of git('ls-files').split('\n').filter(Boolean)) {
    if (SECRET_ALLOW.has(file)) continue;
    const path = join(ROOT, file);
    if (!existsSync(path) || statSync(path).size > 5_000_000) continue;
    if (/\.(png|jpe?g|webp|gif|mp4|mov|ttf|otf|woff2?|xlsx|pdf|ico)$/i.test(file)) continue;
    for (const [kind, ex] of findSecrets(readFileSync(path, 'utf8')))
      failed.push(`${file}: ${kind} (${ex})`);
  }
}

function scanHistory() {
  const log = git(
    'log',
    '--all',
    '--no-color',
    '-p',
    // Merge commits too (round 2, P3): a secret can arrive in a merge alone.
    '-m',
    '-G',
    'sk-|_live_|sb_secret_|AIza|gh[pousr]_|whsec_|PRIVATE KEY|eyJ',
    '--format=commit %H',
  );
  let commit = '';
  let file = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) commit = line.slice(7, 15);
    else if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('+') && !SECRET_ALLOW.has(file))
      for (const [kind, ex] of findSecrets(line))
        failed.push(`history ${commit} ${file}: ${kind} (${ex})`);
  }
}

function scanStaged() {
  let file = '';
  for (const line of git('diff', '--cached', '-U0', '--no-color').split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('+') && !SECRET_ALLOW.has(file))
      for (const [kind, ex] of findSecrets(line)) failed.push(`staged ${file}: ${kind} (${ex})`);
  }
}

function scanDir(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) scanDir(path);
    else if (/\.(js|html|json|map|css)$/.test(name))
      for (const [kind, ex] of findSecrets(readFileSync(path, 'utf8')))
        failed.push(`bundle ${relative(dir, path)}: ${kind} (${ex})`);
  }
}

// --- (d) sinks ---------------------------------------------------------------
// Each sink with the files audited for it (round 2, P3: per sink, so a file
// allowed one sink can't quietly add another).
export const SINKS = [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/, ['src/app/+html.tsx']],
  ['innerHTML', /\.innerHTML\s*=/, []],
  ['outerHTML', /\.outerHTML\s*=/, []],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\s*\(/, []],
  ['document.write', /\bdocument\.write(?:ln)?\s*\(/, []],
  ['eval', /\beval\s*\(/, []],
  ['new Function', /new Function\s*\(/, []],
  // Cloudflare's script, from a constant URL (docs/SECURITY.md rule 1).
  [
    "createElement('script')",
    /createElement\(\s*['"`]script['"`]\s*\)/,
    ['src/features/captcha/TurnstileWidget.web.tsx'],
  ],
  ['WebView', /<WebView\b/, ['src/features/captcha/TurnstileWidget.tsx']],
  ['injectedJavaScript', /\binjectedJavaScript\w*/, []],
  ['srcdoc', /\bsrcdoc\b|\bsrcDoc\b/, ['src/features/captcha/TurnstileWidget.tsx']],
];

/** Sinks a file uses that aren't audited for it. */
export function findSinks(file, text) {
  return SINKS.filter(([, re, allowed]) => !allowed.includes(file) && re.test(text)).map(
    ([name]) => name,
  );
}

function scanSinks() {
  const files = git('ls-files', 'src', 'supabase/functions').split('\n').filter(Boolean);
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file) || /\.test\.(ts|tsx)$/.test(file)) continue;
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const name of findSinks(file, text))
      failed.push(`${file}: "${name}" outside the audited allowlist (docs/SECURITY.md rule 1)`);
  }
}

// --- (e) lockfile integrity --------------------------------------------------
function scanLockfile() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(deps)) {
    const entry = lock.packages?.[`node_modules/${name}`];
    if (!entry) failed.push(`${name}: in package.json but not in package-lock.json`);
    else if (!entry.link && !entry.integrity)
      failed.push(`${name}: no integrity hash in package-lock.json`);
  }
}

// --- (f) npm audit -----------------------------------------------------------
// High/critical advisories with no patched release yet, each tracked in
// docs/SECURITY.md with its path and why it doesn't reach the app bundle.
// Remove an entry as soon as a fixed version ships.
export const TRACKED_ADVISORIES = new Set([
  // node-forge <=1.4.0 via @expo/cli (dev server / update signing, not bundled)
  'GHSA-86w9-cpqp-85rv',
  // braces <=3.0.3 via @expo/cli → metro-file-map → micromatch (dev-server file
  // watching with our own patterns, not bundled); no patched braces yet
  'GHSA-vfj7-8cjw-p6xm',
]);

/** High/critical advisory IDs in an `npm audit --json` report that aren't tracked. */
export function untrackedSevere(report) {
  const ids = new Set();
  for (const pkg of Object.values(report.vulnerabilities ?? {}))
    for (const via of pkg.via ?? [])
      if (typeof via === 'object' && (via.severity === 'high' || via.severity === 'critical')) {
        const id = String(via.url ?? '').split('/').pop() || String(via.source);
        if (!TRACKED_ADVISORIES.has(id)) ids.add(id);
      }
  return [...ids];
}

function audit() {
  let out;
  try {
    out = execFileSync('npm', ['audit', '--omit=dev', '--json'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    out = e.stdout?.toString() ?? '';
  }
  try {
    const report = JSON.parse(out);
    const v = report.metadata?.vulnerabilities;
    if (!v) throw new Error('no report');
    const severe = (v.high ?? 0) + (v.critical ?? 0);
    const untracked = severe ? untrackedSevere(report) : [];
    if (untracked.length)
      failed.push(
        `npm audit: ${v.critical ?? 0} critical, ${v.high ?? 0} high (npm audit --omit=dev): ${untracked.join(', ')}`,
      );
    else if (severe)
      warnings.push(
        `npm audit: ${severe} high/critical, all tracked advisories with no fix yet (docs/SECURITY.md)`,
      );
    if (!untracked.length && v.moderate)
      warnings.push(`npm audit: ${v.moderate} moderate (tracked in docs/SECURITY.md)`);
  } catch {
    // Offline-safe (round 2, P3): a warning on a laptop; in CI an audit that
    // can't run fails, unless the run says --offline on purpose.
    if (process.env.CI) failed.push('npm audit could not run in CI: pass --offline to skip it');
    else warnings.push('npm audit could not run (offline?): run it before a release');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (flag('--staged')) {
    scanStaged();
  } else {
    scanTracked();
    if (!flag('--no-history')) scanHistory();
    if (bundleDir) scanDir(bundleDir);
    scanSinks();
    scanLockfile();
    if (!flag('--offline')) audit();
  }
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (failed.length) {
    console.error(`security:check failed:\n- ${[...new Set(failed)].join('\n- ')}`);
    process.exit(1);
  }
  console.log(
    flag('--staged')
      ? 'security:check (staged): no secrets in this commit'
      : 'security:check passed: no secrets (files, history' +
          (bundleDir ? ', bundle' : '') +
          '), no unaudited HTML/eval/WebView sinks, lockfile integrity, no high/critical audit issues',
  );
}
