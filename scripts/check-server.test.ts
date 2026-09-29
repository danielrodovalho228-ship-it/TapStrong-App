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

/** Runs serverProblems against a fake server; `captcha` says whether Auth enforces it. */
function problems(opts: { captcha: boolean; token?: boolean; auth?: Record<string, unknown> }) {
  const code = `
    const opts = ${JSON.stringify(opts)};
    const fake = async (url, init) => {
      if (url.includes('/auth/v1/otp')) {
        if (JSON.parse(init.body).captcha_token || init.body.includes('gotrue_meta_security'))
          throw new Error('the probe must not send a captcha token');
        return opts.captcha
          ? { status: 400, json: async () => ({ error_code: 'captcha_failed', msg: 'captcha protection: request disallowed' }) }
          : { status: 422, json: async () => ({ error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }) };
      }
      if (url.startsWith('https://api.supabase.com/v1/projects/abcd/config/auth')) {
        if (init.headers.Authorization !== 'Bearer pat') throw new Error('no token');
        return { ok: true, status: 200, json: async () => opts.auth };
      }
      return { status: 401, json: async () => ({ code: '42501' }) };
    };
    import('./scripts/check-server.mjs').then(async (m) =>
      process.stdout.write(JSON.stringify(await m.serverProblems(
        'https://abcd.supabase.co', 'anon', opts.token ? { SUPABASE_ACCESS_TOKEN: 'pat' } : {}, fake))));`;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', code], { cwd: ROOT, encoding: 'utf8' }),
  ) as { problems: string[]; warnings: string[] };
}

const GOOD_AUTH = {
  security_captcha_enabled: true,
  security_captcha_provider: 'turnstile',
  smtp_max_frequency: 60,
  mailer_otp_exp: 900,
  mailer_autoconfirm: false,
  rate_limit_verify: 30,
  rate_limit_anonymous_users: 30,
  password_min_length: 10,
};

describe('security round 2: Auth on the server', () => {
  it('S2-P2-6: a server without captcha fails the check (probe with no token, fake address)', () => {
    expect(problems({ captcha: false }).problems.join()).toMatch(/captcha is off/);
    const ok = problems({ captcha: true });
    expect(ok.problems).toEqual([]);
    // Without a Management API token the limits are only a warning.
    expect(ok.warnings.join()).toMatch(/SUPABASE_ACCESS_TOKEN/);
  });

  it('S2-P2-5: the email-code limits are read from the project and checked', () => {
    expect(problems({ captcha: true, token: true, auth: GOOD_AUTH })).toEqual({
      problems: [],
      warnings: [],
    });
    const bad = problems({
      captcha: true,
      token: true,
      auth: { ...GOOD_AUTH, smtp_max_frequency: 1, mailer_otp_exp: 3600 },
    }).problems.join('\n');
    expect(bad).toMatch(/smtp_max_frequency = 1/);
    expect(bad).toMatch(/mailer_otp_exp = 3600/);
  });
});
