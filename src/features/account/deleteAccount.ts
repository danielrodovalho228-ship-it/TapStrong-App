import { getSupabase } from '@/lib/supabase';

import { useBillingStore } from '../billing/store';
import { useFamilyStore } from '../family/store';
import { useParentPinStore } from '../family/parentPin';
import { clearSnapshots } from '../family/switch';
import { useMomentsStore } from '../moments/store';
import { useShareStore } from '../share/store';
import { useMonthStore } from '../month/store';
import { useOnboardingStore } from '../onboarding/store';
import { deleteAllPhotos } from '../progress/photos';
import { useMovementPainStore } from '../movement/store';
import { useProgramStore } from '../program/store';
import { useProgressStore } from '../progress/store';
import { useRehabStore } from '../rehab/store';
import { useRestrictionsStore } from '../restrictions/store';
import { useWorkoutStore } from '../workout/store';

import { useAccountStore } from './store';

export type DeleteResult = 'ok' | 'offline' | 'error';

/** Wipes every TapStrong store on this phone (all profiles). */
export function wipeLocalData() {
  clearSnapshots();
  useFamilyStore.getState().reset();
  useParentPinStore.getState().reset();
  useOnboardingStore.getState().reset();
  useWorkoutStore.getState().reset();
  useRestrictionsStore.getState().reset();
  useBillingStore.getState().reset();
  useProgressStore.getState().reset();
  useMovementPainStore.getState().reset();
  // Rehab programs are health data too (Phase 30); the ready plan with them.
  useRehabStore.getState().reset();
  useProgramStore.getState().reset();
  useMonthStore.getState().reset();
  useMomentsStore.getState().reset();
  useShareStore.getState().reset();
  deleteAllPhotos();
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
