import {
  activePlan,
  applyEvent,
  planForEntitlements,
  planForProduct,
  PRODUCTS,
  trialReminderAt,
  type RevenueCatEvent,
} from '../../../supabase/functions/_shared/billing';

const user = '11111111-1111-4111-8111-111111111111';
const t = (iso: string) => Date.parse(iso);
const ev = (patch: Partial<RevenueCatEvent>): RevenueCatEvent => ({
  type: 'INITIAL_PURCHASE',
  app_user_id: user,
  product_id: PRODUCTS.family.monthly,
  entitlement_ids: ['family', 'premium'],
  period_type: 'NORMAL',
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  purchased_at_ms: t('2026-10-01T10:00:00Z'),
  expiration_at_ms: t('2026-11-01T10:00:00Z'),
  event_timestamp_ms: t('2026-10-01T10:00:01Z'),
  transaction_id: 'tx-1',
  ...patch,
});

describe('RevenueCat events → subscription row', () => {
  it('a trial is Family access but not a charge (no COPPA consent yet)', () => {
    const row = applyEvent(
      null,
      ev({ period_type: 'TRIAL', expiration_at_ms: t('2026-10-08T10:00:00Z') }),
    )!;
    expect(row).toMatchObject({
      plan: 'family',
      status: 'trial',
      will_renew: true,
      first_charged_at: null,
    });
    expect(row.trial_ends_at).toBe('2026-10-08T10:00:00.000Z');
  });

  it('the first paid renewal after the trial records the charge', () => {
    const trial = applyEvent(null, ev({ period_type: 'TRIAL' }))!;
    const paid = applyEvent(
      trial,
      ev({
        type: 'RENEWAL',
        event_timestamp_ms: t('2026-10-08T10:00:02Z'),
        purchased_at_ms: t('2026-10-08T10:00:00Z'),
      }),
    )!;
    expect(paid).toMatchObject({ status: 'active', first_charged_at: '2026-10-08T10:00:00.000Z' });
    const later = applyEvent(
      paid,
      ev({
        type: 'RENEWAL',
        event_timestamp_ms: t('2026-11-08T10:00:02Z'),
        purchased_at_ms: t('2026-11-08T10:00:00Z'),
      }),
    )!;
    expect(later.first_charged_at).toBe('2026-10-08T10:00:00.000Z');
  });

  it('cancellation keeps access until expiry; expiration ends it', () => {
    const paid = applyEvent(null, ev({}))!;
    const cancelled = applyEvent(
      paid,
      ev({ type: 'CANCELLATION', event_timestamp_ms: t('2026-10-05T00:00:00Z') }),
    )!;
    expect(cancelled).toMatchObject({ status: 'active', will_renew: false });
    expect(activePlan(cancelled, new Date('2026-10-20T00:00:00Z'))).toBe('family');
    expect(activePlan(cancelled, new Date('2026-11-02T00:00:00Z'))).toBe('free');
    const expired = applyEvent(
      cancelled,
      ev({ type: 'EXPIRATION', event_timestamp_ms: t('2026-11-01T10:00:05Z') }),
    )!;
    expect(activePlan(expired, new Date('2026-10-20T00:00:00Z'))).toBe('free');
  });

  it('ignores events that arrive out of order', () => {
    const paid = applyEvent(null, ev({ event_timestamp_ms: t('2026-10-10T00:00:00Z') }))!;
    expect(
      applyEvent(paid, ev({ type: 'EXPIRATION', event_timestamp_ms: t('2026-10-01T00:00:00Z') })),
    ).toBeNull();
  });

  it('a promotional week (referral) never touches a paid plan, and never counts as a charge', () => {
    const paid = applyEvent(null, ev({}))!;
    const promo = ev({
      store: 'PROMOTIONAL',
      period_type: 'PROMOTIONAL',
      product_id: 'rc_promo_premium_weekly',
      entitlement_ids: ['premium'],
      event_timestamp_ms: t('2026-10-02T00:00:00Z'),
    });
    expect(applyEvent(paid, promo)).toBeNull();
    const fresh = applyEvent(null, promo)!;
    expect(fresh).toMatchObject({
      plan: 'premium',
      status: 'active',
      store: 'promotional',
      first_charged_at: null,
      will_renew: false,
    });
  });

  it('billing trouble is a grace period', () => {
    const paid = applyEvent(null, ev({}))!;
    expect(
      applyEvent(
        paid,
        ev({ type: 'BILLING_ISSUE', event_timestamp_ms: t('2026-11-01T11:00:00Z') }),
      )!.status,
    ).toBe('grace');
    expect(applyEvent(paid, ev({ type: 'TEST' }))).toBeNull();
  });

  it('S1-02: sandbox (free test) purchases never grant a plan in production', () => {
    for (const environment of ['SANDBOX', undefined, null, 'sandbox'])
      expect(applyEvent(null, ev({ environment, entitlement_ids: ['family'] }))).toBeNull();
    // Nor do they touch a real subscription.
    const paid = applyEvent(null, ev({}))!;
    expect(applyEvent(paid, ev({ type: 'EXPIRATION', environment: 'SANDBOX' }))).toBeNull();
    // Production is unchanged.
    expect(applyEvent(null, ev({ entitlement_ids: ['family'] }))).toMatchObject({
      plan: 'family',
      status: 'active',
      store: 'app_store',
    });
  });

  it('S1-02: a test project may accept sandbox, but never as a charge', () => {
    const row = applyEvent(null, ev({ environment: 'SANDBOX', entitlement_ids: ['family'] }), {
      acceptSandbox: true,
    })!;
    expect(row).toMatchObject({ plan: 'family', store: 'test', first_charged_at: null });
    const renewed = applyEvent(
      row,
      ev({
        type: 'RENEWAL',
        environment: 'SANDBOX',
        event_timestamp_ms: t('2026-11-01T00:00:00Z'),
      }),
      { acceptSandbox: true },
    )!;
    expect(renewed.first_charged_at).toBeNull();
  });

  it('maps products and entitlements to plans', () => {
    expect(planForProduct(PRODUCTS.premium.annual)).toBe('premium');
    expect(planForProduct('other')).toBe('free');
    expect(planForEntitlements(['premium', 'family'])).toBe('family');
    expect(planForEntitlements([])).toBe('free');
  });

  it('reminds 3 days before the trial ends, never in the past', () => {
    const now = new Date('2026-10-01T10:00:00Z');
    expect(trialReminderAt('2026-10-08T10:00:00Z', now)!.toISOString()).toBe(
      '2026-10-05T10:00:00.000Z',
    );
    expect(trialReminderAt('2026-10-02T10:00:00Z', now)).toBeNull();
    expect(trialReminderAt(null, now)).toBeNull();
  });
});
