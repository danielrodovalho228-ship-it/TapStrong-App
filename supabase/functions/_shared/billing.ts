// Billing rules shared by the app and the Edge Functions (SPEC §8 "Paywall &
// account"; prices and family size: Daniel, Sep 2026). Pure TypeScript.

export type Plan = 'free' | 'premium' | 'family';
export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'expired';
export type Period = 'monthly' | 'annual';

export const FREE_WORKOUTS_PER_WEEK = 3;
export const TRIAL_DAYS = 7;
/** Honest billing: remind 3 days before a trial turns into a charge (SPEC §8; Daniel, Sep 2026). */
export const TRIAL_REMINDER_DAYS = 3;
export const FAMILY_MAX_PROFILES = 5;
export const PARENT_NOTICE_VERSION = 'parent-notice-v1';

/** Store product ids (App Store Connect / Google Play / RevenueCat). */
export const PRODUCTS = {
  premium: { monthly: 'tapstrong_premium_monthly', annual: 'tapstrong_premium_annual' },
  family: { monthly: 'tapstrong_family_monthly', annual: 'tapstrong_family_annual' },
} as const;

/** US list prices, shown when the store has not returned localized prices. */
export const LIST_PRICES_USD = {
  premium: { monthly: 9.99, annual: 59.99 },
  family: { monthly: 14.99, annual: 89.99 },
} as const;

/** RevenueCat entitlement ids. Family includes everything Premium has. */
export const ENTITLEMENTS = { premium: 'premium', family: 'family' } as const;

export function planForProduct(productId: string | null | undefined): Plan {
  if (!productId) return 'free';
  if (productId.startsWith('tapstrong_family')) return 'family';
  if (productId.startsWith('tapstrong_premium')) return 'premium';
  return 'free';
}

export function planForEntitlements(ids: readonly string[] | null | undefined): Plan {
  if (ids?.includes(ENTITLEMENTS.family)) return 'family';
  if (ids?.includes(ENTITLEMENTS.premium)) return 'premium';
  return 'free';
}

export type SubscriptionRow = {
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  product_id: string | null;
  store: 'app_store' | 'play_store' | 'promotional' | 'test' | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  will_renew: boolean;
  first_charged_at: string | null;
  last_transaction_id: string | null;
  last_event_at: string | null;
};

/** The fields of a RevenueCat webhook event that we use. */
export type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  period_type?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  store?: string | null;
  transaction_id?: string | null;
  environment?: string | null;
  /** TRANSFER only: the app user ids the purchase moved away from, and to. */
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
};

const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

function storeOf(e: RevenueCatEvent): SubscriptionRow['store'] {
  if (!isProductionEvent(e)) return 'test';
  switch (e.store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'app_store';
    case 'PLAY_STORE':
      return 'play_store';
    case 'PROMOTIONAL':
      return 'promotional';
    default:
      return null;
  }
}

const CHARGE_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);
const IGNORED = new Set(['TEST', 'TRANSFER', 'SUBSCRIBER_ALIAS', 'INVOICE_ISSUANCE']);

/**
 * A RevenueCat TRANSFER moves a purchase to another account (restore on a new
 * login): the old accounts lose it now (security round 1, P3). The new one
 * gets its plan from the events that follow.
 */
export function transferredAway(e: RevenueCatEvent, options: ApplyOptions = {}): string[] {
  if (e.type !== 'TRANSFER') return [];
  if (!isProductionEvent(e) && !options.acceptSandbox) return [];
  const to = new Set(e.transferred_to ?? []);
  return (e.transferred_from ?? []).filter((id) => !to.has(id));
}

export function expireRow(current: SubscriptionRow, at: string): SubscriptionRow {
  return { ...current, status: 'expired', will_renew: false, expires_at: at, last_event_at: at };
}

export type ApplyOptions = {
  /**
   * Sandbox events (TestFlight, Play test tracks: nothing is charged) are
   * ignored unless the webhook runs on a test project that opts in with
   * REVENUECAT_ACCEPT_SANDBOX=true (security round 1, S1-02).
   */
  acceptSandbox?: boolean;
};

/** Only live store events change a real subscription (S1-02). */
export const isProductionEvent = (e: RevenueCatEvent) => e.environment === 'PRODUCTION';

/**
 * Next `subscriptions` row for a webhook event, or null to ignore it.
 * - Sandbox (free test) purchases are ignored in production; a test project
 *   that accepts them stores them as store 'test', never as a charge.
 * - Out-of-order events (older than the last one applied) are ignored.
 * - A promotional week (referral reward) never overrides a paid plan.
 * - first_charged_at is set on the first paid, non-trial period only; it is
 *   the COPPA consent evidence for child profiles, so trials and
 *   promotional grants never set it.
 */
export function applyEvent(
  current: SubscriptionRow | null,
  e: RevenueCatEvent,
  options: ApplyOptions = {},
): SubscriptionRow | null {
  if (IGNORED.has(e.type) || !e.app_user_id) return null;
  if (!isProductionEvent(e) && !options.acceptSandbox) return null;
  const at = iso(e.event_timestamp_ms) ?? new Date().toISOString();
  if (current?.last_event_at && at < current.last_event_at) return null;

  const store = storeOf(e);
  const eventPlan =
    planForEntitlements(e.entitlement_ids) !== 'free'
      ? planForEntitlements(e.entitlement_ids)
      : planForProduct(e.product_id);
  const paidActive =
    current &&
    current.store !== 'promotional' &&
    (current.status === 'active' || current.status === 'trial' || current.status === 'grace');
  // A promotional week (or its expiry) never touches a paid plan in force.
  if (store === 'promotional' && paidActive) return null;

  const period = (e.period_type ?? '').toUpperCase();
  const base: SubscriptionRow = current ?? {
    user_id: e.app_user_id,
    plan: 'free',
    status: 'expired',
    product_id: null,
    store: null,
    trial_ends_at: null,
    expires_at: null,
    will_renew: false,
    first_charged_at: null,
    last_transaction_id: null,
    last_event_at: null,
  };
  const next: SubscriptionRow = { ...base, last_event_at: at };

  switch (e.type) {
    case 'EXPIRATION':
      return {
        ...next,
        status: 'expired',
        will_renew: false,
        expires_at: iso(e.expiration_at_ms) ?? next.expires_at,
      };
    case 'CANCELLATION':
      // Access continues until expires_at; only auto-renew stops.
      return { ...next, will_renew: false };
    case 'BILLING_ISSUE':
      return { ...next, status: 'grace' };
    case 'SUBSCRIPTION_PAUSED':
      return { ...next, will_renew: false };
    default:
      break;
  }

  const trial = period === 'TRIAL';
  // A test store is never a charge: it can't be consent evidence (S1-02).
  const paid = !trial && period !== 'PROMOTIONAL' && store !== 'promotional' && store !== 'test';
  return {
    ...next,
    plan: eventPlan === 'free' ? next.plan : eventPlan,
    status: trial ? 'trial' : 'active',
    product_id: e.product_id ?? next.product_id,
    store: store ?? next.store,
    expires_at: iso(e.expiration_at_ms) ?? next.expires_at,
    trial_ends_at: trial ? iso(e.expiration_at_ms) : next.trial_ends_at,
    will_renew: e.type !== 'NON_RENEWING_PURCHASE' && store !== 'promotional',
    first_charged_at:
      next.first_charged_at ??
      (paid && CHARGE_EVENTS.has(e.type) ? (iso(e.purchased_at_ms) ?? at) : null),
    last_transaction_id: e.transaction_id ?? next.last_transaction_id,
  };
}

/** Access right now, from a subscription row (or the app's own copy). */
export function activePlan(
  row: Pick<SubscriptionRow, 'plan' | 'status' | 'expires_at'> | null,
  now: Date,
): Plan {
  if (!row || row.status === 'expired') return 'free';
  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) return 'free';
  return row.plan;
}

/** When to remind before a trial charge (null when not on a trial). */
export function trialReminderAt(trialEndsAt: string | null, now: Date): Date | null {
  if (!trialEndsAt) return null;
  const at = new Date(Date.parse(trialEndsAt) - TRIAL_REMINDER_DAYS * 86_400_000);
  return at > now ? at : null;
}
