import { syncNow } from '@/features/account/cloud';
import { canStartWorkout, currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { deviceWeekStart } from '@/lib/dates';

import { useWorkoutStore } from './store';

export type BeginResult = { ok: true } | { ok: false; nextFreeDay?: string };

/**
 * Starts a planned workout (Phase 27, A2: one tap from Home to the player):
 * the free plan's weekly limit first (SPEC §8; the finisher does not count),
 * then "active", the event and a sync so the server notes when it started
 * (referral check, round 2 P3). An active workout just continues.
 */
export function beginWorkout(id: string): BeginResult {
  const store = useWorkoutStore.getState();
  const workout = store.workouts.find((w) => w.id === id);
  if (!workout) return { ok: false };
  if (workout.status !== 'planned') return { ok: true };
  if (workout.kind === 'regular') {
    const check = canStartWorkout(
      currentPlan(useBillingStore.getState().entitlement, clock.now()),
      store.workouts,
      clock.now(),
      deviceWeekStart(),
    );
    if (!check.allowed) return { ok: false, nextFreeDay: check.nextFreeDay };
  }
  store.start(id);
  track('workout_started');
  void syncNow();
  return { ok: true };
}
