// Coach interview: turns one free-text onboarding answer into structured values.
// The Claude API key is a Supabase secret (ANTHROPIC_API_KEY); it never reaches the app.
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  outputSchema,
  parseRequest,
  SYSTEM_PROMPT,
  userPrompt,
  validateOutput,
} from '../_shared/interview.ts';

const MODEL = 'claude-opus-5';

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

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);

let muscleKeysCache: string[] | null = null;

/** Muscle keys come only from the database (SPEC §2.1). */
async function muscleKeys(): Promise<string[]> {
  if (muscleKeysCache) return muscleKeysCache;
  const { data, error } = await supabase.from('muscles').select('key').order('key');
  if (error) throw error;
  muscleKeysCache = (data ?? []).map((row: { key: string }) => row.key);
  return muscleKeysCache;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const parsed = parseRequest(body);
  if ('error' in parsed)
    return json({ error: parsed.error }, parsed.error === 'child_mode' ? 403 : 400);

  try {
    const keys = await muscleKeys();
    // `fallbacks: "default"` re-runs a refused request on Anthropic's recommended
    // fallback model, server side. Not yet in the SDK's request types.
    const params = {
      model: MODEL,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: outputSchema(parsed.step, keys) },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt(parsed, keys) }],
    };
    // deno-lint-ignore no-explicit-any
    const response = await anthropic.beta.messages.create(params as any);

    if (response.stop_reason === 'refusal') return json({ answer: {}, reply: null });

    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') return json({ answer: {}, reply: null });

    let raw: unknown;
    try {
      raw = JSON.parse(text.text);
    } catch {
      return json({ answer: {}, reply: null });
    }
    return json(validateOutput(parsed.step, raw, keys));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503);
    if (error instanceof Anthropic.APIError) {
      console.error('anthropic_error', error.status);
      return json({ error: 'coach_unavailable' }, 502);
    }
    console.error('coach_interview_error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'coach_unavailable' }, 500);
  }
});
