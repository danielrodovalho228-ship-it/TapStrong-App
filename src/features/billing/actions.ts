import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import { requestPermission } from '../notifications/apply';

import { ownerAge } from '../family/profiles';
import { useFamilyStore } from '../family/store';
import { modeOf } from '../onboarding/derived';
import { useOnboardingStore } from '../onboarding/store';

import { getBilling, type PurchaseResult } from './provider';
import { currentPlan, familyPurchaseBlocked, PRODUCTS } from './rules';
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

/** The account owner's age, from their own profile (live or its snapshot). */
export function currentOwnerAge(): number | null {
  const family = useFamilyStore.getState();
  return ownerAge(family.profiles, family.activeId, useOnboardingStore.getState(), (key) =>
    kvStorage.getItem(key),
  );
}

/**
 * The Family plan is bought and shown only by an adult (Daniel, Phase 21):
 * never while a minor's profile is active (a solo teen, a locked teen, or a
 * parent's phone with the teen's profile on), nor for an owner under 18.
 */
export function familyPlanAllowed(): boolean {
  const s = useOnboardingStore.getState();
  const minor = ['teen', 'child'].includes(modeOf(s));
  return !minor && !familyPurchaseBlocked(currentOwnerAge());
}

export async function buy(productId: string): Promise<PurchaseResult | 'adults_only'> {
  // Never start a Family purchase for an owner under 18, whatever the screen shows.
  const family = (Object.values(PRODUCTS.family) as string[]).includes(productId);
  if (family && !familyPlanAllowed()) return 'adults_only';
  // A Family subscription is never changed from a minor's profile: another
  // plan would downgrade the whole family (QA R9-04).
  const onFamily = currentPlan(useBillingStore.getState().entitlement, clock.now()) === 'family';
  if (!family && onFamily && !familyPlanAllowed()) return 'adults_only';
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

/** What "Restore purchases" says for each answer. */
export const restoreMessageKey = (r: PurchaseResult | 'none') =>
  r === 'ok'
    ? 'billing.restored'
    : r === 'none'
      ? 'billing.noneToRestore'
      : r === 'unavailable'
        ? 'billing.errors.unavailable'
        : 'billing.errors.error';

/**
 * "Restore purchases": after the store answers, the entitlement decides what
 * to say. Nothing to restore is not "restored" (QA R8 P2).
 */
export async function restore(): Promise<PurchaseResult | 'none'> {
  const result = await getBilling().restore();
  if (result !== 'ok') return result;
  await refreshBilling();
  return currentPlan(useBillingStore.getState().entitlement, clock.now()) === 'free'
    ? 'none'
    : 'ok';
}
