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
 */
export async function deleteManagedProfileRemote(id: string): Promise<'ok' | 'offline' | 'error'> {
  if (__DEV__ && getBilling().kind === 'dev') return 'ok';
  const supabase = getSupabase();
  if (!supabase) return 'offline';
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    return error ? 'error' : 'ok';
  } catch {
    return 'offline';
  }
}
