// Coach interview: turns one free-text onboarding answer into structured values.
// The Claude API key is a Supabase secret (ANTHROPIC_API_KEY); it never reaches the app.
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  outputSchema,
  parseRequest,
  serverMode,
  SYSTEM_PROMPT,
  userPrompt,
  validateOutput,
  type InterviewRequest,
  type InterviewResult,
} from '../_shared/interview.ts';

// Mapping a short answer onto a fixed list is a simple task: Haiku first,
// Sonnet as the reserve when Haiku fails or declines (Daniel, Sep 27 2026).
const PRIMARY_MODEL = 'claude-haiku-4-5';
const RESERVE_MODEL = 'claude-sonnet-5';
const DAILY_CALL_LIMIT = 30;
// Security round 1, S2-04: per-IP and global daily budgets on top of the
// per-user limit (fresh anonymous accounts can't multiply the spend).
const IP_DAILY_LIMIT = Number(Deno.env.get('COACH_IP_DAILY_LIMIT') ?? 60);
const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('COACH_GLOBAL_DAILY_LIMIT') ?? 5000);
// One try per model, within the function's own time: no silent SDK retries.
const MODEL_TIMEOUT_MS = 20_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
  timeout: MODEL_TIMEOUT_MS,
  maxRetries: 0,
});
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** The caller's IP, hashed (SHA-256) so no raw address is ever stored. */
async function ipHash(req: Request): Promise<string> {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ??
    'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`coach:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let muscleKeysCache: string[] | null = null;

/** Muscle keys come only from the database (SPEC §2.1). */
async function muscleKeys(): Promise<string[]> {
  if (muscleKeysCache) return muscleKeysCache;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.from('muscles').select('key').order('key');
  if (error) throw error;
  const keys = (data ?? []).map((row: { key: string }) => row.key);
  muscleKeysCache = keys;
  return keys;
}

type Attempt = { result: InterviewResult } | { retry: true };

async function ask(model: string, req: InterviewRequest, keys: string[]): Promise<Attempt> {
  const reserve = model === RESERVE_MODEL;
  const params = {
    model,
    max_tokens: 1024,
    output_config: {
      // Haiku 4.5 does not take an effort setting.
      ...(reserve ? { effort: 'low' } : {}),
      format: { type: 'json_schema', schema: outputSchema(req.step, keys) },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(req, keys) }],
  };
  // deno-lint-ignore no-explicit-any
  const response = await anthropic.messages.create(params as any);
  if (response.stop_reason === 'refusal') return { retry: true };

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') return { retry: true };
  try {
    return { result: validateOutput(req.step, JSON.parse(text.text), keys, req.mode) };
  } catch {
    return { retry: true };
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIError) {
    return error.status === 429 || (error.status ?? 0) >= 500;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Every caller needs a session (anonymous is fine) so calls can be limited per user.
  const authorization = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const request = parseRequest(body);
  if ('error' in request) {
    return json({ error: request.error }, request.error === 'child_mode' ? 403 : 400);
  }
  // The age mode comes from the caller's saved profile when there is one,
  // else from the birth date the app sent; never looser than asked (S2-05).
  const { data: own } = await userClient
    .from('profiles')
    .select('birth_year, birth_month')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  const saved = own as { birth_year?: number; birth_month?: number } | null;
  const birth =
    saved?.birth_year && saved?.birth_month
      ? { year: saved.birth_year, month: saved.birth_month }
      : (request.birth ?? null);
  const mode = serverMode(request.mode, birth);
  if (mode === 'child') return json({ error: 'child_mode' }, 403);
  const parsed = { ...request, mode };

  const { data: budget, error: budgetError } = await admin.rpc('consume_coach_budget', {
    ip_hash: await ipHash(req),
    ip_limit: IP_DAILY_LIMIT,
    global_limit: GLOBAL_DAILY_LIMIT,
  });
  if (budgetError) return json({ error: 'coach_unavailable' }, 500);
  if (budget !== 'ok') return json({ error: 'busy' }, 429);

  const { data: allowed, error: limitError } = await userClient.rpc('consume_coach_call', {
    daily_limit: DAILY_CALL_LIMIT,
  });
  if (limitError) return json({ error: 'coach_unavailable' }, 500);
  if (!allowed) return json({ error: 'daily_limit' }, 429);

  try {
    const keys = await muscleKeys();
    let attempt: Attempt;
    try {
      attempt = await ask(PRIMARY_MODEL, parsed, keys);
    } catch (error) {
      if (!retryable(error)) throw error;
      attempt = { retry: true };
    }
    // Anonymous accounts get the primary model only (S2-04).
    if ('retry' in attempt && !auth.user.is_anonymous)
      attempt = await ask(RESERVE_MODEL, parsed, keys);
    return json('result' in attempt ? attempt.result : { answer: {}, reply: null });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('anthropic_error', error.status);
      return json({ error: 'coach_unavailable' }, 502);
    }
    console.error('coach_interview_error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'coach_unavailable' }, 500);
  }
});
