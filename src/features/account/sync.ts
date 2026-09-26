import type { SupabaseClient } from '@supabase/supabase-js';

import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { uuid } from '@/lib/uuid';

import type { Exercise } from '../exercises/types';
import { derive } from '../onboarding/derived';
import { hasRedFlag } from '../onboarding/safety';
import type { OnboardingData } from '../onboarding/store';
import { measurementsAllowed } from '../progress/checkin';
import type { ProgressData } from '../progress/store';
import type { Restriction } from '../restrictions/store';
import type { BadgeKey } from '../workout/badges';
import type { MuscleActivity } from '../workout/recovery';
import type { StreakState } from '../workout/streak';
import type { WorkoutRecord } from '../workout/types';

type Row = Record<string, unknown>;

export type SyncInput = {
  userId: string;
  profileId: string;
  onboarding: OnboardingData;
  restrictions: Restriction[];
  workouts: WorkoutRecord[];
  streak: StreakState;
  activity: Record<string, MuscleActivity>;
  badges: BadgeKey[];
  /** Released exercises in the database: slug → uuid. */
  exerciseIds: Map<string, string>;
  library: Exercise[];
  /** Check-ins and Repair (Phase 8). Photos never leave the phone. */
  progress?: Pick<ProgressData, 'checkins' | 'repairResults' | 'repairPlan'>;
  /**
   * A family member the account holder manages on this phone (Phase 6):
   * the row has no login of its own and the account is its guardian.
   */
  managed?: boolean;
};

export type SessionRows = {
  workoutId: string;
  session: Row;
  items: Row[];
  logs: Row[];
  swaps: Row[];
  pains: Row[];
};

export type SyncPlan = {
  profile: Row;
  /** Managed rows are created once (children only through the consent function). */
  profileWrite: 'upsert' | 'managed' | 'child';
  health: Row;
  preferences: Row | null;
  muscleGoals: Row[];
  restrictions: Row[];
  streak: Row;
  muscleActivity: Row[];
  badges: Row[];
  sessions: SessionRows[];
  checkins: Row[];
  repairResults: Row[];
  repairPlans: Row[];
  /** Finished workouts that use exercises the database does not release. */
  skipped: string[];
};

export type PlanError = 'child' | 'no_profile';

/**
 * Builds the rows to copy the phone's data to the account. Pure, so it is
 * fully unit-tested. Child profiles are never synced from the child's own
 * phone: under 13 they belong to a guardian's family plan (SPEC §2.3, Phase 6).
 */
export function buildSyncPlan(input: SyncInput): SyncPlan | PlanError {
  const s = input.onboarding;
  const derived = derive(s);
  if (!derived) return 'no_profile';
  // A child is only ever synced by the guardian's account, never by itself.
  if (derived.mode === 'child' && !input.managed) return 'child';
  const profileId = input.profileId;
  const child = derived.mode === 'child';

  const profile: Row = {
    id: profileId,
    user_id: input.managed ? null : input.userId,
    guardian_id: input.managed ? input.userId : null,
    birth_month: s.birthMonth,
    birth_year: s.birthYear,
    sex: s.sex ?? null,
    body_band: derived.band,
    // No body measurements for children (SPEC §2.3; the database checks it too).
    height_cm: child ? null : (s.heightCm ?? null),
    weight_kg: child ? null : (s.weightKg ?? null),
    units: s.units,
    locale: s.locale ?? 'en',
    mode: derived.mode,
  };
  const health: Row = {
    id: stableId(profileId, 'health'),
    profile_id: profileId,
    pain_areas: s.painAreas,
    conditions: s.conditions,
    position: s.position,
    red_flag: hasRedFlag(s.painAreas, s.conditions),
  };

  const preferences: Row | null =
    s.location && s.minutes
      ? {
          profile_id: profileId,
          location: s.location,
          minutes: s.minutes,
          days_per_week: s.daysPerWeek ?? 3,
          equipment: s.equipment,
          main_goals: s.mainGoals,
        }
      : null;

  const muscleGoals = s.muscleGoals.map((g, i) => ({
    profile_id: profileId,
    muscle_key: g.muscleKey,
    goal: g.goal,
    priority: Math.min(5, i + 1),
  }));

  const restrictions = input.restrictions.map((r) => ({
    id: r.id,
    profile_id: profileId,
    area: r.area,
    side: r.side ?? null,
    source: r.source,
    active: r.active,
    created_at: r.createdAt,
  }));

  const streak: Row = {
    profile_id: profileId,
    current: input.streak.current,
    best: Math.max(input.streak.best, input.streak.current),
    freezes_available: input.streak.freezes,
    last_active_date: input.streak.lastActive,
    rest_days: input.streak.restDays,
  };

  const muscleActivity = Object.entries(input.activity).map(([key, a]) => ({
    profile_id: profileId,
    muscle_key: key,
    last_trained_at: a.lastPrimaryAt ?? null,
    last_secondary_at: a.lastSecondaryAt ?? null,
    volume_7d: a.sets7d,
  }));

  const badges = input.badges.map((key) => ({ profile_id: profileId, key }));

  const bySlug = (id: string) => {
    const slug = input.library.find((e) => e.id === id)?.slug ?? id;
    return input.exerciseIds.get(slug);
  };

  const sessions: SessionRows[] = [];
  const skipped: string[] = [];
  const pending = input.workouts.filter(
    (w) => (w.status === 'done' || w.status === 'partial') && !w.syncedAt,
  );
  for (const w of pending) {
    const used = new Set([
      ...w.session.items.map((i) => i.exerciseId),
      ...w.logs.map((l) => l.exerciseId),
      ...w.swaps.flatMap((x) => [x.fromExerciseId, x.toExerciseId]),
    ]);
    if ([...used].some((id) => !bySlug(id))) {
      skipped.push(w.id);
      continue;
    }
    const itemIds = new Map(w.session.items.map((i) => [i.id, uuid()]));
    const order = new Map(w.session.items.map((i, n) => [i.id, n]));
    sessions.push({
      workoutId: w.id,
      session: {
        id: w.id,
        profile_id: profileId,
        kind: w.kind,
        status: w.status,
        minutes: w.session.minutes,
        scheduled_for: localDate(new Date(w.createdAt)),
        started_at: w.startedAt ?? null,
        ended_at: w.endedAt ?? null,
        created_at: w.createdAt,
      },
      items: w.session.items.map((i, n) => ({
        id: itemIds.get(i.id),
        session_id: w.id,
        order: n,
        exercise_id: bySlug(i.exerciseId),
        role: i.role,
        part: i.part,
        target_muscle: i.targetMuscle,
        goal: i.goal,
        sets: i.sets,
        reps_min: i.reps?.[0] ?? null,
        reps_max: i.reps?.[1] ?? null,
        hold_s_min: i.holdSeconds?.[0] ?? null,
        hold_s_max: i.holdSeconds?.[1] ?? null,
        duration_s: i.durationSeconds ?? null,
        rest_s: i.restSeconds,
        per_side: i.perSide,
        load_hint: i.loadHint,
      })),
      logs: w.logs.map((l) => ({
        session_item_id: itemIds.get(l.itemId),
        exercise_id: bySlug(l.exerciseId),
        set_no: l.setNo,
        reps: l.reps ?? null,
        seconds: l.seconds ?? null,
        load: l.load ?? null,
        unit: l.load != null ? (l.unit ?? null) : null,
        logged_at: l.loggedAt,
      })),
      swaps: w.swaps.map((x) => ({
        profile_id: profileId,
        session_id: w.id,
        item_order: order.get(x.itemId) ?? 0,
        from_exercise_id: bySlug(x.fromExerciseId),
        to_exercise_id: bySlug(x.toExerciseId),
        reason: x.reason,
        sets_done_before: x.setsDoneBefore,
        swapped_at: x.at,
      })),
      pains: w.pains.map((p) => ({
        profile_id: profileId,
        session_id: w.id,
        exercise_id: bySlug(p.exerciseId) ?? null,
        area: p.area,
        side: p.side ?? null,
        type: p.type,
        action_taken: p.action,
        reported_at: p.reportedAt,
      })),
    });
  }

  // Body measurements only for adult and 60+ profiles (SPEC §2.3; a database
  // trigger refuses them otherwise). Out-of-range values are left out.
  const body = measurementsAllowed(derived.mode);
  const within = (v: number | undefined, min: number, max: number) =>
    body && v != null && v >= min && v <= max ? v : null;
  const progress = input.progress ?? { checkins: [], repairResults: [], repairPlan: null };
  const checkins = progress.checkins.map((c) => ({
    id: c.id,
    profile_id: profileId,
    taken_at: c.takenAt,
    strength: c.strength,
    waist_cm: within(c.waistCm, 30, 250),
    weight_kg: within(c.weightKg, 20, 350),
    whtr: within(c.whtr, 0.2, 1.5),
    bmi: within(c.bmi, 8, 90),
  }));
  const repairResults = progress.repairResults.map((r) => ({
    id: stableId(profileId, `repair:${r.testKey}:${r.testedAt}`),
    profile_id: profileId,
    test_key: r.testKey,
    value: r.value ?? null,
    left_value: r.left ?? null,
    right_value: r.right ?? null,
    pass_left: r.passLeft ?? null,
    pass_right: r.passRight ?? null,
    tested_at: r.testedAt,
  }));
  const plan = progress.repairPlan;
  const repairPlans = plan
    ? [
        {
          id: stableId(profileId, `repair-plan:${plan.createdAt}`),
          profile_id: profileId,
          weeks: plan.weeks,
          sessions_per_week: plan.sessionsPerWeek,
          focus: plan.focus,
          retest_at: plan.retestAt,
          created_at: plan.createdAt,
        },
      ]
    : [];

  return {
    profile,
    profileWrite: !input.managed ? 'upsert' : child ? 'child' : 'managed',
    health,
    preferences,
    muscleGoals,
    restrictions,
    streak,
    muscleActivity,
    badges,
    sessions,
    checkins,
    repairResults,
    repairPlans,
    skipped,
  };
}

/**
 * Owner rows are upserted. Managed rows are updated when they exist and
 * inserted once otherwise (the database checks the Family plan on insert);
 * a child's row is only ever created by create_child_profile().
 */
async function writeProfile(supabase: SupabaseClient, plan: SyncPlan): Promise<{ error: unknown }> {
  if (plan.profileWrite === 'upsert') return supabase.from('profiles').upsert(plan.profile);
  const { id, ...fields } = plan.profile;
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', id as string)
    .select('id');
  if (error) return { error };
  if ((data ?? []).length > 0) return { error: null };
  if (plan.profileWrite === 'child') return { error: 'child_profile_missing' };
  return supabase.from('profiles').insert(plan.profile);
}

/** A per-profile uuid for single-row tables that need an id (stable across syncs). */
export function stableId(profileId: string, salt: string): string {
  let h = 0x811c9dc5;
  const src = `${profileId}:${salt}`;
  const hex: string[] = [];
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < src.length; i++) {
      h ^= src.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex.push(h.toString(16).padStart(8, '0'));
  }
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

export type SyncResult =
  | { status: 'ok'; synced: string[]; skipped: string[] }
  | { status: 'skipped'; reason: PlanError | 'no_account' | 'offline' }
  | { status: 'error'; step: string };

/**
 * Runs a plan against Supabase. Upserts keep it safe to repeat; workouts
 * are copied once and then marked as synced on the phone.
 */
export async function runSync(
  supabase: SupabaseClient,
  gather: (
    userId: string,
    exerciseIds: Map<string, string>,
    /** The account's existing profile row, when signing in to an older account. */
    existingProfileId: string | null,
  ) => SyncPlan | PlanError,
  slugs: string[],
): Promise<SyncResult> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || user.is_anonymous) return { status: 'skipped', reason: 'no_account' };

  const { data: rows, error: exErr } = await supabase
    .from('exercises')
    .select('id, slug')
    .in('slug', slugs.length ? slugs : ['-']);
  if (exErr) return { status: 'error', step: 'exercises' };
  const ids = new Map((rows ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]));

  const { data: existing, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { status: 'error', step: 'profiles' };

  const plan = gather(user.id, ids, (existing as { id: string } | null)?.id ?? null);
  if (typeof plan === 'string') return { status: 'skipped', reason: plan };

  type Step = [string, () => PromiseLike<{ error: unknown }>];
  const steps: Step[] = [
    ['profiles', () => writeProfile(supabase, plan)],
    ['health_screen', () => supabase.from('health_screen').upsert(plan.health)],
  ];
  const { preferences } = plan;
  if (preferences)
    steps.push(['preferences', () => supabase.from('preferences').upsert(preferences)]);
  steps.push([
    'muscle_goals',
    () =>
      supabase
        .from('muscle_goals')
        .delete()
        .eq('profile_id', plan.profile.id as string),
  ]);
  if (plan.muscleGoals.length) {
    steps.push(['muscle_goals', () => supabase.from('muscle_goals').insert(plan.muscleGoals)]);
  }
  if (plan.restrictions.length) {
    steps.push(['restrictions', () => supabase.from('restrictions').upsert(plan.restrictions)]);
  }
  steps.push(['streaks', () => supabase.from('streaks').upsert(plan.streak)]);
  if (plan.muscleActivity.length) {
    steps.push([
      'muscle_activity',
      () => supabase.from('muscle_activity').upsert(plan.muscleActivity),
    ]);
  }
  if (plan.badges.length) {
    steps.push(['badges', () => supabase.from('badges').upsert(plan.badges)]);
  }
  for (const [table, rows2] of [
    ['checkins', plan.checkins],
    ['repair_results', plan.repairResults],
    ['repair_plans', plan.repairPlans],
  ] as const) {
    if (rows2.length) steps.push([table, () => supabase.from(table).upsert(rows2)]);
  }
  for (const [step, run] of steps) {
    const { error } = await run();
    if (error) return { status: 'error', step };
  }

  const synced: string[] = [];
  for (const s of plan.sessions) {
    const { error } = await supabase.from('sessions').upsert(s.session);
    if (error) return { status: 'error', step: 'sessions' };
    // Children of the session are replaced, so a retried sync never duplicates.
    for (const table of ['session_items', 'exercise_swaps', 'pain_reports'] as const) {
      await supabase.from(table).delete().eq('session_id', s.workoutId);
    }
    for (const [table, rows2] of [
      ['session_items', s.items],
      ['set_logs', s.logs],
      ['exercise_swaps', s.swaps],
      ['pain_reports', s.pains],
    ] as const) {
      if (!rows2.length) continue;
      const { error: e } = await supabase.from(table).insert(rows2);
      if (e) return { status: 'error', step: table };
    }
    synced.push(s.workoutId);
  }
  return { status: 'ok', synced, skipped: plan.skipped };
}

export const nowIso = () => clock.now().toISOString();
