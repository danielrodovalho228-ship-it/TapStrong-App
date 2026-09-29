import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isNetworkError } from '@/lib/network';
import { kvStorage } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase';

import { getBilling } from '../billing/provider';
import { PARENT_NOTICE_VERSION } from '../billing/rules';
import type { Sex } from '../onboarding/options';

export type ChildCreate = 'ok' | 'not_charged' | 'offline' | 'error';

/**
 * Creates a child profile on the server with the parent's consent record
 * (COPPA: charged Family plan + accepted notice, checked by the database).
 * Development builds without RevenueCat record consent on the phone only.
 */
export async function createChildProfileRemote(input: {
  id: string;
  birthMonth: number;
  birthYear: number;
  sex: Sex | null;
  name: string | null;
}): Promise<ChildCreate> {
  if (__DEV__ && getBilling().kind === 'dev') return 'ok';
  const supabase = getSupabase();
  if (!supabase) return 'offline';
  try {
    const { error } = await supabase.rpc('create_child_profile', {
      profile_id: input.id,
      birth_month: input.birthMonth,
      birth_year: input.birthYear,
      sex: input.sex,
      display_name: input.name,
      notice_version: PARENT_NOTICE_VERSION,
    });
    if (!error) return 'ok';
    return error.code === '42501' ? 'not_charged' : 'error';
  } catch {
    return 'offline';
  }
}

/**
 * Deletes a managed profile in the cloud (RLS: its guardian only). Its
 * workouts, restrictions and consent record go with it (on delete cascade).
 * Development builds and profiles never synced have nothing to delete.
 * A teen with their own login is theirs to delete: the server refuses the
 * guardian (security round 2, P3), which comes back as 'own_login'.
 */
export async function deleteManagedProfileRemote(
  id: string,
): Promise<'ok' | 'own_login' | 'offline' | 'error'> {
  if (__DEV__ && getBilling().kind === 'dev') return 'ok';
  const supabase = getSupabase();
  if (!supabase) return 'offline';
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) return isNetworkError(error, status) ? 'offline' : 'error';
    if (data?.length) return 'ok';
    // Nothing deleted: never synced (fine), or a profile with its own login.
    const { data: row, error: readError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (readError) return 'error';
    return (row as { user_id?: string | null } | null)?.user_id ? 'own_login' : 'ok';
  } catch {
    return 'offline';
  }
}

/**
 * Cloud deletes that didn't go through (QA round 3): kept on the phone and
 * retried on the next sync or Family visit, so a removed member doesn't stay
 * in the account.
 */
type PendingState = { ids: string[]; add: (id: string) => void; done: (id: string) => void };

export const usePendingDeletesStore = create<PendingState>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) => set({ ids: [...new Set([...get().ids, id])] }),
      done: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
    }),
    {
      name: 'family-pending-deletes',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ ids }) => ({ ids }),
    },
  ),
);

/** Deletes in the cloud, or queues it for later. */
export async function deleteOrQueue(id: string): Promise<'ok' | 'own_login' | 'queued'> {
  const result = await deleteManagedProfileRemote(id);
  if (result === 'ok' || result === 'own_login') {
    usePendingDeletesStore.getState().done(id);
    return result;
  }
  usePendingDeletesStore.getState().add(id);
  return 'queued';
}

/** Retries every queued delete; returns how many are still waiting. */
export async function retryPendingDeletes(): Promise<number> {
  for (const id of usePendingDeletesStore.getState().ids) {
    const result = await deleteManagedProfileRemote(id);
    if (result === 'ok' || result === 'own_login') usePendingDeletesStore.getState().done(id);
  }
  return usePendingDeletesStore.getState().ids.length;
}
