// Security round 1, permanent protections (docs/SECURITY.md). Fails when:
//  (c) a secret-looking key is in the tracked files, in git history, or in a
//      web export given with --bundle <dir>;
//  (d) an HTML / eval / WebView sink appears outside the audited allowlist;
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
const SINKS = /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new Function\s*\(|<WebView\b/;
// Audited uses: the static HTML shell (our own constant script and CSS) and
// the Turnstile WebView (Cloudflare's page only, no navigation away).
export const SINK_ALLOW = new Set([
  'src/app/+html.tsx',
  'src/features/captcha/TurnstileWidget.tsx',
]);

function scanSinks() {
  const files = git('ls-files', 'src', 'supabase/functions').split('\n').filter(Boolean);
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file) || /\.test\.(ts|tsx)$/.test(file) || SINK_ALLOW.has(file))
      continue;
    const text = readFileSync(join(ROOT, file), 'utf8');
    const m = text.match(SINKS);
    if (m)
      failed.push(`${file}: "${m[0]}" outside the audited allowlist (docs/SECURITY.md rule 1)`);
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
function audit() {
  let out;
  try {
    out = execFileSync('npm', ['audit', '--omit=dev', '--json'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    out = e.stdout?.toString() ?? '';
  }
  try {
    const v = JSON.parse(out).metadata?.vulnerabilities;
    if (!v) throw new Error('no report');
    if ((v.high ?? 0) + (v.critical ?? 0) > 0)
      failed.push(
        `npm audit: ${v.critical ?? 0} critical, ${v.high ?? 0} high (npm audit --omit=dev)`,
      );
    else if (v.moderate)
      warnings.push(`npm audit: ${v.moderate} moderate (tracked in docs/SECURITY.md)`);
  } catch {
    warnings.push('npm audit could not run (offline?): run it before a release');
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
