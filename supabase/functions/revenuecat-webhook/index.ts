// RevenueCat webhook → public.subscriptions (the store truth the database
// trusts for Family limits and child consent). Called by RevenueCat, not by
// the app: deploy with verify_jwt = false and set REVENUECAT_WEBHOOK_SECRET
// (the same value goes in RevenueCat's "Authorization header" setting).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { applyEvent, type RevenueCatEvent, type SubscriptionRow } from '../_shared/billing.ts';
import { json, safeEqual } from '../_shared/http.ts';

const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);

  let event: RevenueCatEvent;
  try {
    const body = (await req.json()) as { event?: RevenueCatEvent };
    if (!body.event) throw new Error('no event');
    event = body.event;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  // App user ids are Supabase user ids; anonymous RevenueCat ids are ignored.
  if (!UUID.test(event.app_user_id ?? '')) return json({ ignored: 'app_user_id' });

  const { data: current, error: readError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', event.app_user_id)
    .maybeSingle();
  if (readError) return json({ error: 'read' }, 500);

  const next = applyEvent(current as SubscriptionRow | null, event);
  if (!next) return json({ ignored: event.type });

  const { error } = await admin
    .from('subscriptions')
    .upsert({ ...next, updated_at: new Date().toISOString() });
  // A 500 makes RevenueCat retry the delivery later.
  if (error) return json({ error: 'write' }, 500);
  return json({ ok: true, plan: next.plan, status: next.status });
});
