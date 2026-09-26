import { track } from '@/lib/analytics';

import { requestPermission } from '../notifications/apply';

import { getBilling } from './provider';
import { useBillingStore } from './store';

/** Pulls the latest entitlement and prices from the store (best effort). */
export async function refreshBilling(): Promise<void> {
  const billing = getBilling();
  try {
    const [entitlement, prices] = await Promise.all([billing.entitlement(), billing.prices()]);
    const before = useBillingStore.getState().entitlement;
    // Cancelling happens in the store; we notice it as auto-renew turning off.
    if (before.plan !== 'free' && before.willRenew && !entitlement.willRenew) {
      track('subscription_cancelled');
    }
    useBillingStore.getState().set({
      entitlement,
      prices: Object.keys(prices).length ? prices : useBillingStore.getState().prices,
      ...(entitlement.plan !== 'free' ? { hadTrial: true } : {}),
    });
  } catch {
    // Offline: keep the last known copy.
  }
}

export async function buy(productId: string) {
  const before = useBillingStore.getState().entitlement;
  const result = await getBilling().purchase(productId);
  if (result === 'ok') {
    await refreshBilling();
    const after = useBillingStore.getState().entitlement;
    if (after.status === 'trial' && before.status !== 'trial') {
      track('trial_started');
      // The reminder before the first charge needs notification permission.
      void requestPermission().catch(() => undefined);
    } else if (after.plan !== 'free') track('subscription_started');
  }
  return result;
}

export async function restore() {
  const result = await getBilling().restore();
  if (result === 'ok') await refreshBilling();
  return result;
}
