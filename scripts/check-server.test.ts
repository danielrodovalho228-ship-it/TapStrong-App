/**
 * Phase 23 answer 3: a production build checks that the server has the
 * functions from the latest migrations (anon key only, no data read).
 */
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = join(__dirname, '..');

/** Runs missingOnServer against a fake API where `absent` functions don't exist. */
function missing(absent: string[]): [string, string][] {
  const code = `
    const absent = ${JSON.stringify(absent)};
    const fake = async (url, init) => {
      const fn = url.split('/rpc/')[1];
      if (!init.headers.apikey) throw new Error('no apikey');
      return absent.includes(fn)
        ? { status: 404, json: async () => ({ code: 'PGRST202' }) }
        : { status: 401, json: async () => ({ code: '42501' }) };
    };
    import('./scripts/check-server.mjs').then(async (m) =>
      process.stdout.write(JSON.stringify(await m.missingOnServer('https://x.supabase.co/', 'anon', fake))));`;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
  );
}

it('a server with every migration passes (permission errors mean the function exists)', () => {
  expect(missing([])).toEqual([]);
});

it('names the migration of each missing function', () => {
  expect(missing(['verify_parent_pin', 'account_code_locked_until'])).toEqual([
    ['20261018000100_security_s1_server_pin', 'verify_parent_pin'],
    ['20261018000400_security_s2_account_code', 'account_code_locked_until'],
  ]);
});
