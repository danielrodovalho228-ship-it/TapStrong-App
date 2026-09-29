// Coach budgets (security round 1, S2-04; round 2, P3). Pure, so jest tests it.

/**
 * The caller's IP from the platform header only. Supabase's Edge runtime sits
 * behind Cloudflare, which sets `cf-connecting-ip` itself; `x-real-ip` and
 * `x-forwarded-for` can carry whatever the client sent, so they are never
 * read. No header (or an empty one) shares one "unknown" bucket.
 */
export function platformIp(get: (name: string) => string | null): string {
  const ip = (get('cf-connecting-ip') ?? '').trim();
  return ip || 'unknown';
}

export type ChargeResult = 'ok' | 'daily_limit' | 'busy';

/**
 * Charges one coach call. The caller's own daily limit is checked first, so
 * an account already at its cap never spends the IP or global budgets that
 * everyone shares.
 */
export async function chargeCoachCall(spend: {
  user: () => Promise<boolean>;
  shared: () => Promise<string>;
}): Promise<ChargeResult> {
  if (!(await spend.user())) return 'daily_limit';
  return (await spend.shared()) === 'ok' ? 'ok' : 'busy';
}
