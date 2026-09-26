import { clock } from '@/lib/clock';

import type { BillingProvider } from './provider';
import { planForProduct, TRIAL_DAYS } from './rules';
import { FREE, useBillingStore, type Entitlement } from './store';

/**
 * Development-only purchase simulator (required inside `if (__DEV__)`, so
 * release bundles never contain it). Lets the flows be tested before the
 * RevenueCat account and store products exist.
 */
const DAY = 86_400_000;

export const devProvider: BillingProvider = {
  kind: 'dev',
  identify: async () => undefined,
  entitlement: async () => useBillingStore.getState().entitlement,
  prices: async () => ({}),
  async purchase(productId) {
    const now = clock.now().getTime();
    const hadTrial = useBillingStore.getState().hadTrial;
    const period = productId.endsWith('annual') ? 365 : 30;
    const next: Entitlement = hadTrial
      ? {
          plan: planForProduct(productId),
          status: 'active',
          productId,
          trialEndsAt: null,
          expiresAt: new Date(now + period * DAY).toISOString(),
          willRenew: true,
          firstChargedAt: new Date(now).toISOString(),
        }
      : {
          plan: planForProduct(productId),
          status: 'trial',
          productId,
          trialEndsAt: new Date(now + TRIAL_DAYS * DAY).toISOString(),
          expiresAt: new Date(now + TRIAL_DAYS * DAY).toISOString(),
          willRenew: true,
          firstChargedAt: null,
        };
    useBillingStore.getState().set({ entitlement: next, hadTrial: true });
    return 'ok';
  },
  restore: async () => 'ok',
};

/** Dev only: the trial ends and the first charge goes through. */
export function simulateFirstCharge() {
  const e = useBillingStore.getState().entitlement;
  if (e.plan === 'free') return;
  const now = clock.now().getTime();
  useBillingStore.getState().set({
    entitlement: {
      ...e,
      status: 'active',
      trialEndsAt: null,
      expiresAt: new Date(now + 30 * DAY).toISOString(),
      firstChargedAt: new Date(now).toISOString(),
    },
  });
}

/** Dev only: back to the free plan. */
export function simulateExpiry() {
  useBillingStore.getState().set({ entitlement: FREE });
}
