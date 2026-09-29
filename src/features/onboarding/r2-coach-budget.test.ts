/**
 * Security round 2, P3 "Coach budgets": only the platform IP header counts,
 * an empty one still gets a bucket, and a capped account never spends the
 * shared IP / global budgets.
 */
import { chargeCoachCall, platformIp } from '../../../supabase/functions/_shared/coachBudget';

const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;

it('reads only cf-connecting-ip, never a client-supplied x-real-ip / x-forwarded-for', () => {
  expect(platformIp(headers({ 'cf-connecting-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  expect(
    platformIp(
      headers({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }),
    ),
  ).toBe('unknown');
  expect(
    platformIp(headers({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.2' })),
  ).toBe('203.0.113.9');
});

it('an empty header is "unknown", not an empty key', () => {
  expect(platformIp(headers({ 'cf-connecting-ip': '  ' }))).toBe('unknown');
  expect(platformIp(headers({}))).toBe('unknown');
});

it('the per-user limit is checked before the shared budgets are spent', async () => {
  const order: string[] = [];
  const shared = jest.fn(async () => {
    order.push('shared');
    return 'ok';
  });
  expect(await chargeCoachCall({ user: async () => false, shared })).toBe('daily_limit');
  expect(shared).not.toHaveBeenCalled();
  expect(
    await chargeCoachCall({
      user: async () => {
        order.push('user');
        return true;
      },
      shared,
    }),
  ).toBe('ok');
  expect(order).toEqual(['user', 'shared']);
  expect(await chargeCoachCall({ user: async () => true, shared: async () => 'ip_limit' })).toBe(
    'busy',
  );
});
