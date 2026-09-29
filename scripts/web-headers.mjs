// Security round 1, S2-06: security headers for the web host, from the
// exported HTML (the CSP must list the hash of every inline script). The host
// isn't chosen yet, so both files are written into the export folder:
//   _headers     — Netlify and Cloudflare Pages
//   vercel.json  — Vercel
// Run after `expo export --platform web`: node scripts/web-headers.mjs <dir>
// (`npm run web:export` does both, security round 2 P3). It refuses an
// export whose CSP doesn't match its inline scripts.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

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
  // No includeSubDomains / preload until the domain is decided (round 2, P3):
  // preload is hard to undo and would bind every subdomain.
  'Strict-Transport-Security': 'max-age=63072000',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

/** Every HTML page in an export whose CSP doesn't list exactly its inline scripts. */
export function cspProblems(dir) {
  const problems = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.html')) {
        const html = readFileSync(path, 'utf8');
        const file = relative(dir, path);
        let policy;
        try {
          policy = headerPolicy(html);
        } catch {
          problems.push(`${file}: no Content-Security-Policy meta tag`);
          continue;
        }
        const scripts = inlineScripts(html);
        for (const src of scripts)
          if (!policy.includes(hashOf(src)))
            problems.push(`${file}: inline script not in the CSP ("${src.slice(0, 40)}…")`);
        const listed = policy.match(/'sha256-[^']+'/g) ?? [];
        if (listed.length !== scripts.length)
          problems.push(`${file}: CSP lists ${listed.length} hashes for ${scripts.length} scripts`);
      }
    }
  };
  walk(dir);
  return problems;
}

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
  const problems = cspProblems(dir);
  if (problems.length) {
    console.error(
      `web:headers refused: the CSP doesn't match the pages:\n- ${problems.join('\n- ')}`,
    );
    process.exit(1);
  }
  writeHeaders(dir);
  console.log(`web headers written to ${dir}/_headers and ${dir}/vercel.json`);
}
