// Delete account (App Store rule; Daniel, Sep 2026). Deletes the signed-in
// user; every table that belongs to the account cascades from auth.users
// (profiles, managed family profiles, workouts, consent, referrals,
// subscription copy). Store subscriptions are NOT cancelled here — Apple and
// Google only allow that from the store, and the app says so before this runs.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

import { corsHeaders, json } from '../_shared/http.ts';

const RC_SECRET = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // handled below
  }
  if (body.confirm !== 'DELETE') return json({ error: 'confirm' }, 400);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'delete_failed' }, 500);

  // Also remove the customer's purchase history at RevenueCat (privacy).
  if (RC_SECRET) {
    await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RC_SECRET}` },
    }).catch(() => undefined);
  }
  return json({ ok: true });
});
