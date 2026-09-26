import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';

import type { Plan, SubscriptionStatus } from '../../../supabase/functions/_shared/billing';

/**
 * The phone's copy of the subscription (from RevenueCat, or the development
 * simulator). The database copy (webhook) is what server rules trust.
 */
export type Entitlement = {
  plan: Plan;
  status: SubscriptionStatus;
  productId: string | null;
  trialEndsAt: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  /** Set once a paid period started (COPPA consent evidence on the server). */
  firstChargedAt: string | null;
};

export const FREE: Entitlement = {
  plan: 'free',
  status: 'expired',
  productId: null,
  trialEndsAt: null,
  expiresAt: null,
  willRenew: false,
  firstChargedAt: null,
};

type State = {
  entitlement: Entitlement;
  /** Localized store prices by product id (e.g. "$9.99"). */
  prices: Record<string, string>;
  /** A free trial was used before: offer the plan without "free trial" copy. */
  hadTrial: boolean;
  set: (patch: Partial<Omit<State, 'set' | 'reset'>>) => void;
  reset: () => void;
};

export const useBillingStore = create<State>()(
  persist(
    (set) => ({
      entitlement: FREE,
      prices: {},
      hadTrial: false,
      set: (patch) => set(patch),
      reset: () => set({ entitlement: FREE, prices: {}, hadTrial: false }),
    }),
    {
      name: 'billing',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ entitlement: s.entitlement, prices: s.prices, hadTrial: s.hadTrial }),
    },
  ),
);
