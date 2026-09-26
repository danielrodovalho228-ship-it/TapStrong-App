import { getSupabase } from '@/lib/supabase';

import { useBillingStore } from '../billing/store';
import { useFamilyStore } from '../family/store';
import { clearSnapshots } from '../family/switch';
import { useOnboardingStore } from '../onboarding/store';
import { useRestrictionsStore } from '../restrictions/store';
import { useWorkoutStore } from '../workout/store';

import { useAccountStore } from './store';

export type DeleteResult = 'ok' | 'offline' | 'error';

/** Wipes every TapStrong store on this phone (all profiles). */
export function wipeLocalData() {
  clearSnapshots();
  useFamilyStore.getState().reset();
  useOnboardingStore.getState().reset();
  useWorkoutStore.getState().reset();
  useRestrictionsStore.getState().reset();
  useBillingStore.getState().reset();
  useAccountStore.getState().reset();
}

/**
 * Deletes the account and all its data on the server (delete-account Edge
 * Function), then on the phone. Without a saved account only the phone's
 * data exists, so only that is deleted.
 */
export async function deleteAccount(): Promise<DeleteResult> {
  if (useAccountStore.getState().saved) {
    const supabase = getSupabase();
    if (!supabase) return 'offline';
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: 'DELETE' },
      });
      if (error) return 'error';
      await supabase.auth.signOut();
    } catch {
      return 'offline';
    }
  }
  wipeLocalData();
  return 'ok';
}
