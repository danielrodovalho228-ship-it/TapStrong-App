import { clock } from '@/lib/clock';
import { getSupabase } from '@/lib/supabase';

import { refreshBilling } from '../billing/actions';
import { getBilling } from '../billing/provider';
import { devLibrary } from '../exercises/library';
import { activeProfile, useFamilyStore } from '../family/store';
import { useOnboardingStore } from '../onboarding/store';
import { useRestrictionsStore } from '../restrictions/store';
import { badgeStatus } from '../workout/badges';
import { muscleActivity } from '../workout/recovery';
import { useWorkoutStore } from '../workout/store';

import { useAccountStore } from './store';
import { buildSyncPlan, runSync, type SyncResult } from './sync';

let running: Promise<SyncResult> | null = null;

/**
 * Copies the phone's data to the saved account. Safe to call often: it does
 * nothing without a saved account or backend, and never runs twice at once.
 */
export function syncNow(): Promise<SyncResult> {
  if (running) return running;
  const supabase = getSupabase();
  if (!supabase || !useAccountStore.getState().saved) {
    return Promise.resolve({ status: 'skipped', reason: supabase ? 'no_account' : 'offline' });
  }
  const library = devLibrary();
  const workouts = useWorkoutStore.getState();
  const slugs = [...new Set(library.map((e) => e.slug))];

  running = runSync(
    supabase,
    (userId, exerciseIds, existingProfileId) => {
      const now = clock.now();
      const active = activeProfile(useFamilyStore.getState());
      const managed = !!active && active.kind !== 'self';
      // Signing in to an account that already has a profile: keep its row.
      if (
        !managed &&
        existingProfileId &&
        existingProfileId !== useAccountStore.getState().profileId
      ) {
        useAccountStore.getState().update({ profileId: existingProfileId });
      }
      return buildSyncPlan({
        userId,
        managed,
        profileId: managed ? active.id : useAccountStore.getState().profileId,
        onboarding: useOnboardingStore.getState(),
        restrictions: useRestrictionsStore.getState().items,
        workouts: workouts.workouts,
        streak: workouts.streak,
        activity: muscleActivity(workouts.workouts, library, now),
        badges: badgeStatus(workouts.workouts, workouts.streak, library, now)
          .filter((b) => b.earned)
          .map((b) => b.key),
        exerciseIds,
        library,
      });
    },
    slugs,
  )
    .then((result) => {
      if (result.status === 'ok') {
        const at = clock.now().toISOString();
        useWorkoutStore.getState().markSynced(result.synced, at);
        useAccountStore.getState().update({ lastSyncAt: at });
        if (result.synced.length) void claimReferralReward();
      }
      return result;
    })
    .catch((): SyncResult => ({ status: 'skipped', reason: 'offline' }))
    .finally(() => {
      running = null;
    });
  return running;
}

/** After the account is saved: link purchases, redeem a pending referral, then sync. */
export async function afterAccountSaved(): Promise<void> {
  const supabase = getSupabase();
  const account = useAccountStore.getState();
  // Purchases belong to the account (RevenueCat app user id = Supabase user id).
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) {
    await getBilling()
      .identify(data.user.id)
      .catch(() => undefined);
    await refreshBilling();
  }
  if (supabase && account.pendingReferral && !account.referralRedeemed) {
    const { error } = await supabase.rpc('redeem_referral', {
      referral_code: account.pendingReferral,
    });
    if (!error) account.update({ referralRedeemed: true, pendingReferral: undefined });
  }
  await syncNow();
}

/** The account's invite code (created on first use). Null for child profiles or offline. */
export async function loadReferralCode(): Promise<string | null> {
  const account = useAccountStore.getState();
  if (account.referralCode) return account.referralCode;
  const supabase = getSupabase();
  if (!supabase || !account.saved) return null;
  const { data, error } = await supabase.rpc('my_referral_code');
  if (error || typeof data !== 'string') return null;
  account.update({ referralCode: data });
  return data;
}

/** Share links point at the web domain when set, else the app scheme. */
export function referralLink(code: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}/r/${code}` : `tapstrong://r/${code}`;
}

/**
 * Asks the server for the referral week once a workout has synced: it is
 * granted only after the invited person's first completed workout, once.
 */
export async function claimReferralReward(): Promise<void> {
  const account = useAccountStore.getState();
  const supabase = getSupabase();
  if (!supabase || !account.referralRedeemed || account.referralRewardDone) return;
  try {
    const { data } = await supabase.functions.invoke('referral-reward', { body: {} });
    const status = (data as { status?: string } | null)?.status;
    if (status === 'rewarded' || status === 'already_rewarded' || status === 'no_referral') {
      account.update({ referralRewardDone: true });
      if (status === 'rewarded') void refreshBilling();
    }
  } catch {
    // Retried after the next synced workout.
  }
}
