import { getSupabase } from '@/lib/supabase';

import { sanitizeCard, sanitizeInvite, sanitizeLook, type CardLook } from './public';
import type { CardData } from './types';

export type OpenedLink = { card: CardData; look: CardLook; invite: string | null };

const CODE = /^[a-hjkmnp-z2-9]{8}$/;

/**
 * Opens a share link through the share-link Edge Function (Phase 28, D):
 * no login, the server counts the open and limits each IP. What comes back
 * is rebuilt from known values only (public.ts); anything else is "missing".
 */
export async function loadShareLink(raw: string | undefined): Promise<OpenedLink | null> {
  const code = (raw ?? '').trim().toLowerCase();
  if (!CODE.test(code)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('share-link', { body: { code } });
    if (error || !data || data.status !== 'ok') return null;
    const card = sanitizeCard(data.template, data.data);
    if (!card) return null;
    return { card, look: sanitizeLook(data.data), invite: sanitizeInvite(data.invite) };
  } catch {
    return null;
  }
}
