import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';
import { isNetworkError } from '@/lib/network';
import { getSupabase } from '@/lib/supabase';

import { refreshBilling } from '../billing/actions';
import { getBilling } from '../billing/provider';
import { devLibrary } from '../exercises/library';
import { ownerOnboarding } from '../family/profiles';
import { retryPendingDeletes } from '../family/remote';
import { activeProfile, useFamilyStore } from '../family/store';
import { derive } from '../onboarding/derived';
import { repairPhaseDone } from '../movement/progress';
import { useMomentsStore } from '../moments/store';
import { useMonthStore } from '../month/store';
import { useMovementPainStore } from '../movement/store';
import { useOnboardingStore } from '../onboarding/store';
import { useProgressStore } from '../progress/store';
import { useRestrictionsStore } from '../restrictions/store';
import { useShareStore } from '../share/store';
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
  // Member removals that failed offline (QA round 3).
  void retryPendingDeletes();
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
        badges: badgeStatus(workouts.workouts, workouts.streak, library, now, {
          mode: derive(useOnboardingStore.getState())?.mode,
          unit: useOnboardingStore.getState().units === 'imperial' ? 'lb' : 'kg',
          repairPhaseDone: repairPhaseDone(useMovementPainStore.getState().reports),
        })
          .filter((b) => b.earned)
          .map((b) => b.key),
        exerciseIds,
        library,
        progress: useProgressStore.getState(),
        movementPain: useMovementPainStore.getState().reports,
        months: useMonthStore.getState().history,
        moments: useMomentsStore.getState().shown,
        shareLinks: useShareStore.getState().links,
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

export type OwnerSync = 'ok' | 'offline' | 'no_account' | 'no_profile' | 'error';

/**
 * Before a family profile is created (Phase 12): the owner's own profile must
 * be in the cloud, because the database checks the owner's age from it (QA
 * R2-04). Upserts just that row. Development builds without RevenueCat have
 * no cloud family and skip it.
 */
export async function ensureOwnerProfileSynced(): Promise<OwnerSync> {
  if (__DEV__ && getBilling().kind === 'dev') return 'ok';
  const supabase = getSupabase();
  if (!supabase) return 'offline';
  if (!useAccountStore.getState().saved) return 'no_account';
  const family = useFamilyStore.getState();
  const owner = ownerOnboarding(
    family.profiles,
    family.activeId,
    useOnboardingStore.getState(),
    kvStorage.getItem,
  );
  const derived = owner
    ? derive({ birthMonth: owner.birthMonth, birthYear: owner.birthYear })
    : null;
  if (!owner || !derived) return 'no_profile';
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    // QA R3-02: supabase-js reports a dropped connection as an error, not a throw.
    if (isNetworkError(authError)) return 'offline';
    const user = auth.user;
    if (!user || user.is_anonymous) return 'no_account';
    const {
      data: existing,
      error: readError,
      status: readStatus,
    } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (readError) return isNetworkError(readError, readStatus) ? 'offline' : 'error';
    const { error, status } = await supabase.from('profiles').upsert({
      id: (existing as { id: string } | null)?.id ?? useAccountStore.getState().profileId,
      user_id: user.id,
      birth_month: owner.birthMonth,
      birth_year: owner.birthYear,
      sex: owner.sex ?? null,
      body_band: derived.band,
      mode: derived.mode,
      units: owner.units ?? 'metric',
      locale: owner.locale ?? 'en',
    });
    if (!error) return 'ok';
    return isNetworkError(error, status) ? 'offline' : 'error';
  } catch {
    return 'offline';
  }
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
    if (!error) {
      account.update({ referralRedeemed: true, pendingReferral: undefined });
      track('referral_signup');
    }
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
