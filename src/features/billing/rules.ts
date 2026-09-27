import { weekStart, localDate, type WeekStartDay } from '@/lib/dates';

import {
  activePlan,
  FREE_WORKOUTS_PER_WEEK,
  LIST_PRICES_USD,
  PRODUCTS,
  type Period,
  type Plan,
} from '../../../supabase/functions/_shared/billing';
import type { WorkoutRecord } from '../workout/types';

import type { Entitlement } from './store';

export * from '../../../supabase/functions/_shared/billing';

/** Plan in force now, from the phone's entitlement copy. */
/**
 * Only an adult buys the Family plan (Daniel, Phase 13: payment change
 * approved): a 17-year-old owner can't start or be charged for it. The
 * database already refuses family profiles to an under-18 owner (QA R2-04).
 */
export const FAMILY_MIN_OWNER_AGE = 18;
export function familyPurchaseBlocked(ownerAge: number | null): boolean {
  return ownerAge !== null && ownerAge < FAMILY_MIN_OWNER_AGE;
}

export function currentPlan(e: Entitlement, now: Date): Plan {
  return activePlan({ plan: e.plan, status: e.status, expires_at: e.expiresAt }, now);
}

/**
 * Workouts started this calendar week (SPEC §8: free plan = 3 a week). The
 * 10-minute finisher extends a workout already counted, so it is free.
 */
export function workoutsThisWeek(
  workouts: WorkoutRecord[],
  now: Date,
  startsOn: WeekStartDay,
): number {
  const week = weekStart(localDate(now), startsOn);
  return workouts.filter(
    (w) =>
      w.kind === 'regular' &&
      w.status !== 'planned' &&
      w.startedAt &&
      weekStart(localDate(new Date(w.startedAt)), startsOn) === week,
  ).length;
}

export type StartCheck = { allowed: true } | { allowed: false; nextFreeDay: string };

export function canStartWorkout(
  plan: Plan,
  workouts: WorkoutRecord[],
  now: Date,
  startsOn: WeekStartDay,
): StartCheck {
  if (plan !== 'free') return { allowed: true };
  if (workoutsThisWeek(workouts, now, startsOn) < FREE_WORKOUTS_PER_WEEK) return { allowed: true };
  const start = weekStart(localDate(now), startsOn);
  const [y, m, d] = start.split('-').map(Number);
  return { allowed: false, nextFreeDay: localDate(new Date(y, m - 1, d + 7, 12)) };
}

/** Price to show: the store's localized string, else the US list price. */
export function priceLabel(
  prices: Record<string, string>,
  plan: Exclude<Plan, 'free'>,
  period: Period,
): string {
  return prices[PRODUCTS[plan][period]] ?? `$${LIST_PRICES_USD[plan][period].toFixed(2)}`;
}

/** Store page where the subscription is managed or cancelled (SPEC §2.5). */
export function manageSubscriptionUrl(os: string, productId: string | null): string {
  if (os === 'android') {
    const sku = productId ? `&sku=${encodeURIComponent(productId)}` : '';
    return `https://play.google.com/store/account/subscriptions?package=app.tapstrong${sku}`;
  }
  return 'https://apps.apple.com/account/subscriptions';
}
