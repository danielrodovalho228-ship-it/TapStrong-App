/** Security round 1, S2-06: the web page's Content-Security-Policy. */
import { createHash } from 'crypto';

import { contentSecurityPolicy, EXPO_HYDRATE_SCRIPT, scriptHash } from './csp';

it('hashes match the standard SHA-256 base64 the browser computes', () => {
  for (const s of [EXPO_HYDRATE_SCRIPT, 'a', 'ab', "try{x('é')}catch(e){}"])
    expect(scriptHash(s)).toBe(
      `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`,
    );
});

it('allows only the listed inline scripts, our Supabase project and the services we use', () => {
  const csp = contentSecurityPolicy(['x()', EXPO_HYDRATE_SCRIPT], 'https://abcd.supabase.co');
  expect(csp).toContain(
    `script-src 'self' ${scriptHash('x()')} ${scriptHash(EXPO_HYDRATE_SCRIPT)}`,
  );
  expect(csp).not.toMatch(/unsafe-inline'[^;]*;\s*$|script-src[^;]*unsafe-(inline|eval)/);
  expect(csp).toContain('https://abcd.supabase.co wss://abcd.supabase.co');
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(csp).toContain("form-action 'self'");
  // frame-ancestors is ignored in a meta tag: headers only.
  expect(csp).not.toContain('frame-ancestors');
  expect(contentSecurityPolicy([], undefined, { forHeader: true })).toContain(
    "frame-ancestors 'none'",
  );
});

it('round 2 P3: connect-src lists only the PostHog and Sentry hosts this build uses', () => {
  const csp = contentSecurityPolicy([], 'https://abcd.supabase.co', {
    posthogHost: 'https://eu.i.posthog.com',
    sentryDsn: 'https://pubkey@o123.ingest.de.sentry.io/456',
  });
  const connect = csp.split('; ').find((d) => d.startsWith('connect-src'))!;
  expect(connect).toBe(
    "connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co https://eu.i.posthog.com https://o123.ingest.de.sentry.io",
  );
  expect(connect).not.toContain('*');
  // Not set, or not https: nothing added.
  const bare = contentSecurityPolicy([], undefined, {
    posthogHost: 'http://x.test',
    sentryDsn: '',
  });
  expect(bare.split('; ').find((d) => d.startsWith('connect-src'))).toBe("connect-src 'self'");
});
