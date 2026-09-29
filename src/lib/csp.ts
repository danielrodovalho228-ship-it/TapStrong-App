import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Content-Security-Policy for the web export (security round 1, S2-06). The
 * page has two inline scripts — our theme script and Expo Router's hydrate
 * flag — allowed by their SHA-256 hashes, nothing else inline. The same
 * policy (plus frame-ancestors, which a meta tag can't carry) is written as
 * host headers by scripts/web-headers.mjs; `web:check` fails if a hash
 * doesn't match the scripts in the exported HTML.
 */
export const EXPO_HYDRATE_SCRIPT = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export const scriptHash = (source: string) => `'sha256-${base64(sha256(utf8ToBytes(source)))}'`;

/** The Supabase origin (https and wss) from the build's public URL. */
function supabaseOrigins(url: string | undefined): string[] {
  try {
    const u = new URL(url ?? '');
    return [`https://${u.host}`, `wss://${u.host}`];
  } catch {
    return [];
  }
}

export function contentSecurityPolicy(
  inlineScripts: string[],
  supabaseUrl: string | undefined,
  { forHeader = false }: { forHeader?: boolean } = {},
): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${inlineScripts.map(scriptHash).join(' ')} https://challenges.cloudflare.com`,
    [
      "connect-src 'self'",
      ...supabaseOrigins(supabaseUrl),
      'https://*.posthog.com',
      'https://*.ingest.sentry.io',
      'https://*.ingest.us.sentry.io',
      'https://*.ingest.de.sentry.io',
    ].join(' '),
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Cloudflare Turnstile (security round 1, S2-04) runs in its own frame.
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(forHeader ? ["frame-ancestors 'none'"] : []),
  ];
  return directives.join('; ');
}
