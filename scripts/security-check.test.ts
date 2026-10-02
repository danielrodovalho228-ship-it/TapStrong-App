/**
 * Security round 1: the secret scanner behind `npm run security:check` and
 * the pre-commit hook (docs/SECURITY.md rule 3).
 */
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function findSecrets(text: string): [string, string][] {
  const code = `import('./scripts/security-check.mjs').then((m) => process.stdout.write(JSON.stringify(m.findSecrets(${JSON.stringify(text)}))))`;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
  );
}

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJlc2lnbmF0dXJl`;

it('flags the key patterns from the round-1 list', () => {
  const samples = [
    'ANTHROPIC_API_KEY=sk-ant-api03-' + 'x'.repeat(30),
    'key: sk_' + 'live_' + 'a'.repeat(24),
    'rk_' + 'live_' + 'b'.repeat(24),
    'sb_' + 'secret_' + 'c'.repeat(24),
    'AIza' + 'd'.repeat(35),
    'ghp_' + 'e'.repeat(36),
    'whsec_' + 'f'.repeat(24),
    '-----BEGIN ' + 'PRIVATE KEY-----',
    jwt({ role: 'service_role', iss: 'supabase' }),
  ];
  for (const s of samples)
    expect([s.slice(0, 12), findSecrets(s).length]).toEqual([s.slice(0, 12), 1]);
});

it('leaves ordinary text and the public anon key alone', () => {
  expect(findSecrets('task-runner sk- short, skip_live_view, AIzaShort')).toEqual([]);
  expect(findSecrets(jwt({ role: 'anon', iss: 'supabase' }))).toEqual([]);
});

/** Round 2, P3: the sinks a file uses outside its per-sink allowlist. */
function findSinks(file: string, text: string): string[] {
  const code = `import('./scripts/security-check.mjs').then((m) => process.stdout.write(JSON.stringify(m.findSinks(${JSON.stringify(file)}, ${JSON.stringify(text)}))))`;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
  );
}

it('round 2 P3: flags script injection, injectedJavaScript, insertAdjacentHTML, document.write, srcdoc', () => {
  const f = 'src/features/x.tsx';
  expect(findSinks(f, "const s = document.createElement('script');")).toEqual([
    "createElement('script')",
  ]);
  expect(findSinks(f, '<WebView injectedJavaScript={code} />')).toEqual([
    'WebView',
    'injectedJavaScript',
  ]);
  expect(findSinks(f, 'el.insertAdjacentHTML("beforeend", html)')).toEqual(['insertAdjacentHTML']);
  expect(findSinks(f, 'document.write(x)')).toEqual(['document.write']);
  expect(findSinks(f, '<iframe srcdoc={html} />')).toEqual(['srcdoc']);
  expect(findSinks(f, 'const ok = "plain text";')).toEqual([]);
});

it('round 2 P3: the allowlist is per sink, not per file', () => {
  const web = 'src/features/captcha/TurnstileWidget.web.tsx';
  expect(findSinks(web, "document.createElement('script')")).toEqual([]);
  // The same file may not add another sink.
  expect(findSinks(web, 'el.innerHTML = x')).toEqual(['innerHTML']);
  const native = 'src/features/captcha/TurnstileWidget.tsx';
  expect(findSinks(native, '<WebView source={x} />')).toEqual([]);
  expect(findSinks(native, '<WebView injectedJavaScript={x} />')).toEqual(['injectedJavaScript']);
});

it('round 2 P3: the hook installer never replaces another core.hooksPath', () => {
  const code = `import('./scripts/install-hooks.mjs').then((m) => process.stdout.write(JSON.stringify(['', '.githooks', '.husky'].map(m.planHooks))))`;
  expect(
    JSON.parse(
      execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
    ),
  ).toEqual(['install', 'already', 'keep']);
});

describe('npm audit tracking', () => {
  function untracked(report: unknown): string[] {
    const code = `import('./scripts/security-check.mjs').then((m) => process.stdout.write(JSON.stringify(m.untrackedSevere(${JSON.stringify(report)}))))`;
    return JSON.parse(
      execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
    );
  }
  const advisory = (id: string, severity: string) => ({
    vulnerabilities: {
      pkg: { via: [{ severity, url: `https://github.com/advisories/${id}` }] },
      parent: { via: ['pkg'] },
    },
  });

  it('lets only tracked high advisories through', () => {
    expect(untracked(advisory('GHSA-86w9-cpqp-85rv', 'high'))).toEqual([]);
    expect(untracked(advisory('GHSA-xxxx-yyyy-zzzz', 'high'))).toEqual(['GHSA-xxxx-yyyy-zzzz']);
    expect(untracked(advisory('GHSA-xxxx-yyyy-zzzz', 'critical'))).toEqual([
      'GHSA-xxxx-yyyy-zzzz',
    ]);
    expect(untracked(advisory('GHSA-xxxx-yyyy-zzzz', 'moderate'))).toEqual([]);
  });
});
