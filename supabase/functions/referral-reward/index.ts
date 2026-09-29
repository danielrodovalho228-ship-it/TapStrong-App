// Referral reward (Daniel, Sep 2026): 1 free week of Premium for both people,
// only after the invited person completes a first workout. The invited person
// gets it once; the inviter gets 1 week per friend, up to 4 in any 365 days.
// Called by the app (signed-in user = the invited person) after a workout
// syncs. Grants RevenueCat promotional entitlements with the secret key.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

import { ENTITLEMENTS } from '../_shared/billing.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const RC_SECRET = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';
const INVITER_WEEKS_PER_YEAR = 4;
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

async function grantWeek(userId: string): Promise<boolean> {
  const url =
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}` +
    `/entitlements/${ENTITLEMENTS.premium}/promotional`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RC_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration: 'weekly' }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!RC_SECRET) return json({ status: 'not_configured' });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user || user.is_anonymous) return json({ status: 'no_account' }, 401);

  const { data: referral } = await admin
    .from('referrals')
    .select('id, code, rewarded_at, referral_codes!inner(user_id)')
    .eq('invited_user_id', user.id)
    .maybeSingle();
  if (!referral) return json({ status: 'no_referral' });
  if (referral.rewarded_at) return json({ status: 'already_rewarded' });

  const { data: firstWorkout } = await admin.rpc('first_completed_workout', { uid: user.id });
  if (!firstWorkout) return json({ status: 'no_workout_yet' });

  // Claim first, so two calls can never grant twice.
  const { data: claimed } = await admin
    .from('referrals')
    .update({ rewarded_at: new Date().toISOString(), reward_error: null })
    .eq('id', referral.id)
    .is('rewarded_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return json({ status: 'already_rewarded' });

  const inviterId = (referral.referral_codes as unknown as { user_id: string }).user_id;

  const invitedOk = await grantWeek(user.id);
  if (!invitedOk) {
    await admin
      .from('referrals')
      .update({ rewarded_at: null, reward_error: 'grant_invited_failed' })
      .eq('id', referral.id);
    return json({ status: 'error' }, 502);
  }
  // The inviter's yearly cap is checked and taken in one locked step
  // (security round 1, P3): two rewards at once can't both pass it.
  let inviterGranted = false;
  const { data: claimedWeek } = await admin.rpc('claim_inviter_reward', {
    referral_id: referral.id,
    yearly_cap: INVITER_WEEKS_PER_YEAR,
  });
  if (claimedWeek === true) {
    inviterGranted = await grantWeek(inviterId);
    if (!inviterGranted) await admin.rpc('release_inviter_reward', { referral_id: referral.id });
  }
  return json({ status: 'rewarded', inviter: inviterGranted });
});
