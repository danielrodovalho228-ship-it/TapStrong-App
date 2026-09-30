// Share link lookup (Phase 28, D): the public page tapstrong.app/c/<code>
// asks for a shared card's safe data. No login (deployed with
// --no-verify-jwt): anyone with the link may see the card, nothing else.
// The lookup counts the open and spends a per-IP daily budget (hashed IP,
// never the raw address); the table itself stays closed to everyone but
// the owner, and the function runs only with the service role.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

import { platformIp } from '../_shared/coachBudget.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { parseShareCode } from '../_shared/shareLink.ts';

const IP_DAILY_LIMIT = Number(Deno.env.get('SHARE_IP_DAILY_LIMIT') ?? 300);
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

async function ipHash(req: Request): Promise<string> {
  const ip = platformIp((name) => req.headers.get(name));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`share:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const code = parseShareCode(await req.json().catch(() => null));
  if (!code) return json({ status: 'not_found' }, 404);

  const { data, error } = await admin.rpc('share_link_open', {
    link_code: code,
    ip_hash: await ipHash(req),
    ip_limit: IP_DAILY_LIMIT,
  });
  if (error) return json({ status: 'error' }, 500);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { template: string | null; data: unknown; invite_code: string | null; status: string }
    | undefined;
  if (!row || row.status === 'limit') return json({ status: 'limit' }, 429);
  if (row.status !== 'ok') return json({ status: 'not_found' }, 404);
  return json({ status: 'ok', template: row.template, data: row.data, invite: row.invite_code });
});
