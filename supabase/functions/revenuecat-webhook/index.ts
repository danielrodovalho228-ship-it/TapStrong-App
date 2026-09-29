// RevenueCat webhook → public.subscriptions (the store truth the database
// trusts for Family limits and child consent). Called by RevenueCat, not by
// the app: deploy with verify_jwt = false and set REVENUECAT_WEBHOOK_SECRET
// (the same value goes in RevenueCat's "Authorization header" setting).
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

import {
  applyEvent,
  expireRow,
  transferExpires,
  transferredAway,
  type RevenueCatEvent,
  type SubscriptionRow,
} from '../_shared/billing.ts';
import { json, safeEqual } from '../_shared/http.ts';

const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
// Only a test project sets this: in production, sandbox (free test) purchases
// never grant a plan (security round 1, S1-02).
const acceptSandbox = Deno.env.get('REVENUECAT_ACCEPT_SANDBOX') === 'true';
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
  // A purchase moved to another login: the old accounts lose it (P3).
  const away = transferredAway(event, { acceptSandbox }).filter((id) => UUID.test(id));
  if (event.type === 'TRANSFER') {
    const at = new Date(event.event_timestamp_ms ?? Date.now()).toISOString();
    for (const id of away) {
      const { data: row } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      // Only a row older than the transfer, for the same product (round 2, P3).
      if (!row || !transferExpires(row as SubscriptionRow, event)) continue;
      const { error } = await admin
        .from('subscriptions')
        .upsert({ ...expireRow(row as SubscriptionRow, at), updated_at: new Date().toISOString() });
      if (error) return json({ error: 'write' }, 500);
    }
    return json({ ok: true, expired: away.length });
  }
  // App user ids are Supabase user ids; anonymous RevenueCat ids are ignored.
  if (!UUID.test(event.app_user_id ?? '')) return json({ ignored: 'app_user_id' });

  const { data: current, error: readError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', event.app_user_id)
    .maybeSingle();
  if (readError) return json({ error: 'read' }, 500);

  const next = applyEvent(current as SubscriptionRow | null, event, { acceptSandbox });
  if (!next) return json({ ignored: event.type });

  const { error } = await admin
    .from('subscriptions')
    .upsert({ ...next, updated_at: new Date().toISOString() });
  // A 500 makes RevenueCat retry the delivery later.
  if (error) return json({ error: 'write' }, 500);
  return json({ ok: true, plan: next.plan, status: next.status });
});
