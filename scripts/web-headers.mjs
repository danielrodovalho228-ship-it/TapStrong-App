// Security round 1, S2-06: security headers for the web host, from the
// exported HTML (the CSP must list the hash of every inline script). The host
// isn't chosen yet, so both files are written into the export folder:
//   _headers     — Netlify and Cloudflare Pages
//   vercel.json  — Vercel
// Run after `expo export --platform web`: node scripts/web-headers.mjs <dir>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((s) => s.length > 0);
}

export const hashOf = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/** The page's meta CSP, plus frame-ancestors (headers only). */
export function headerPolicy(html) {
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
  if (!meta) throw new Error('no Content-Security-Policy meta tag in index.html');
  const policy = meta[1].replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
  return `${policy}; frame-ancestors 'none'`;
}

export const SECURITY_HEADERS = (csp) => ({
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

export function writeHeaders(dir) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const headers = SECURITY_HEADERS(headerPolicy(html));
  const lines = ['/*', ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`)];
  writeFileSync(join(dir, '_headers'), `${lines.join('\n')}\n`);
  writeFileSync(
    join(dir, 'vercel.json'),
    `${JSON.stringify(
      {
        headers: [
          {
            source: '/(.*)',
            headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return headers;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/web-headers.mjs <web export dir>');
    process.exit(1);
  }
  writeHeaders(dir);
  console.log(`web headers written to ${dir}/_headers and ${dir}/vercel.json`);
}
