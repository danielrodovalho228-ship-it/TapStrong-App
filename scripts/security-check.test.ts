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
