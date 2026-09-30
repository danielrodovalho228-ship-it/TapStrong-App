// Share links (Phase 28, D). Pure, so jest tests it.

/** Same alphabet as the app: 8 characters, no look-alikes (0/o, 1/l/i). */
export const SHARE_CODE = /^[a-hjkmnp-z2-9]{8}$/;

/** The code from the request body `{ code }`, or null. */
export function parseShareCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const code = (body as { code?: unknown }).code;
  if (typeof code !== 'string') return null;
  const clean = code.trim().toLowerCase();
  return SHARE_CODE.test(clean) ? clean : null;
}
