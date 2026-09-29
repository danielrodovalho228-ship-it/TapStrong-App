import {
  validateOutput,
  type InterviewMode,
  type InterviewResult,
} from '../../../supabase/functions/_shared/interview';

import type { SupportedLocale } from '@/i18n';
import { ensureSession, getSupabase } from '@/lib/supabase';

import { MUSCLE_KEYS } from '../muscles';

import { parseScheduleLocally } from './interview';
import type { InterviewStep } from './options';

export type CoachResult = InterviewResult & { source: 'coach' | 'local' | 'none' };

type Context = {
  locale: SupportedLocale;
  mode: InterviewMode;
  /** The server derives the age mode from it before a profile is saved (S2-05). */
  birth?: { year: number; month: number };
};

/** A short pause between coach calls (security round 1, S2-04): no rapid-fire spend. */
export const COACH_COOLDOWN_MS = 1500;
let lastCallAt = 0;
/** Tests only. */
export const resetCoachCooldown = () => {
  lastCallAt = 0;
};

/**
 * Interprets a free-text interview answer. Uses the `coach-interview` Edge
 * Function (Claude) when Supabase is configured, else an offline parser.
 * The result is always re-validated here against the allowed values.
 */
export async function interpretAnswer(
  step: InterviewStep,
  text: string,
  ctx: Context,
): Promise<CoachResult> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      if (!(await ensureSession(supabase))) return offline(step, text);
      const wait = lastCallAt + COACH_COOLDOWN_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastCallAt = Date.now();
      const { data, error } = await supabase.functions.invoke('coach-interview', {
        body: {
          step,
          text,
          locale: ctx.locale,
          mode: ctx.mode,
          ...(ctx.birth ? { birth: ctx.birth } : {}),
        },
      });
      if (!error && data && typeof data === 'object' && 'answer' in data) {
        const raw = data as { answer: Record<string, unknown>; reply: unknown };
        return { ...revalidate(step, raw, ctx.mode), source: 'coach' };
      }
    } catch {
      // Fall through to the offline parser.
    }
  }
  return offline(step, text);
}

function offline(step: InterviewStep, text: string): CoachResult {
  if (step === 'schedule') {
    const answer = parseScheduleLocally(text);
    if (Object.keys(answer).length) return { answer, reply: null, source: 'local' };
  }
  return { answer: {}, reply: null, source: 'none' };
}

/** The function returns camelCase answers; map back to the schema shape and validate. */
function revalidate(
  step: InterviewStep,
  data: { answer: Record<string, unknown>; reply: unknown },
  mode: InterviewMode,
): InterviewResult {
  const a = data.answer;
  const raw = {
    reply: data.reply,
    main_goals: a.mainGoals,
    location: a.location,
    minutes: a.minutes,
    days_per_week: a.daysPerWeek,
    equipment: a.equipment,
    muscle_goals: Array.isArray(a.muscleGoals)
      ? a.muscleGoals.map((m: { muscleKey?: unknown; goal?: unknown }) => ({
          muscle_key: m?.muscleKey,
          goal: m?.goal,
        }))
      : undefined,
    sex: a.sex === null ? 'neutral' : a.sex,
    height_cm: a.heightCm,
    weight_kg: a.weightKg,
  };
  return validateOutput(step, raw, MUSCLE_KEYS, mode);
}
