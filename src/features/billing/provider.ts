import { Platform } from 'react-native';

import { ENTITLEMENTS, PRODUCTS, planForEntitlements } from './rules';
import { FREE, type Entitlement } from './store';

export type PurchaseResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

/** One interface for RevenueCat, the development simulator, and "not set up". */
export interface BillingProvider {
  kind: 'revenuecat' | 'dev' | 'unavailable';
  identify(userId: string): Promise<void>;
  entitlement(): Promise<Entitlement>;
  prices(): Promise<Record<string, string>>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const ALL_PRODUCTS = Object.values(PRODUCTS).flatMap((p) => Object.values(p));

type RC = typeof import('react-native-purchases').default;
type CustomerInfo = import('react-native-purchases').CustomerInfo;

function fromCustomerInfo(info: CustomerInfo): Entitlement {
  const active = info.entitlements.active;
  const plan = planForEntitlements(Object.keys(active));
  if (plan === 'free') return FREE;
  const e = active[plan === 'family' ? ENTITLEMENTS.family : ENTITLEMENTS.premium];
  const trial = e.periodType === 'TRIAL';
  return {
    plan,
    status: trial ? 'trial' : 'active',
    productId: e.productIdentifier,
    trialEndsAt: trial ? e.expirationDate : null,
    expiresAt: e.expirationDate,
    willRenew: e.willRenew,
    firstChargedAt: trial ? null : e.originalPurchaseDate,
  };
}

function revenueCat(Purchases: RC, apiKey: string): BillingProvider {
  Purchases.configure({ apiKey });
  return {
    kind: 'revenuecat',
    async identify(userId) {
      await Purchases.logIn(userId);
    },
    async entitlement() {
      return fromCustomerInfo(await Purchases.getCustomerInfo());
    },
    async prices() {
      const products = await Purchases.getProducts(ALL_PRODUCTS);
      return Object.fromEntries(products.map((p) => [p.identifier, p.priceString]));
    },
    async purchase(productId) {
      try {
        const [product] = await Purchases.getProducts([productId]);
        if (!product) return 'unavailable';
        await Purchases.purchaseStoreProduct(product);
        return 'ok';
      } catch (e) {
        return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error';
      }
    },
    async restore() {
      try {
        await Purchases.restorePurchases();
        return 'ok';
      } catch {
        return 'error';
      }
    },
  };
}

const unavailable: BillingProvider = {
  kind: 'unavailable',
  identify: async () => undefined,
  entitlement: async () => FREE,
  prices: async () => ({}),
  purchase: async () => 'unavailable',
  restore: async () => 'unavailable',
};

let provider: BillingProvider | null = null;

/**
 * RevenueCat when its public SDK key is set and the native module exists
 * (development or store builds, not Expo Go). Otherwise the development
 * simulator in dev builds, and "unavailable" in release builds.
 */
export function getBilling(): BillingProvider {
  if (provider) return provider;
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  if (key) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Purchases = (require('react-native-purchases') as { default: RC }).default;
      provider = revenueCat(Purchases, key);
      return provider;
    } catch {
      // Native module missing (Expo Go): fall through.
    }
  }
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    provider = (require('./devProvider') as typeof import('./devProvider')).devProvider;
    return provider;
  }
  provider = unavailable;
  return provider;
}

/** For tests. */
export function setBilling(next: BillingProvider | null) {
  provider = next;
}
