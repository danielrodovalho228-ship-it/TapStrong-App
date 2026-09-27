import seed from '../../../supabase/seed/exercises.json';
import { isUuid, uuid } from '@/lib/uuid';

import { fromSeed, type SeedExercise } from '../exercises/library';
import { generateSession } from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import { planNotifications, TRAINING_DAYS } from '../notifications/plan';
import { initialOnboarding, type OnboardingData } from '../onboarding/store';
import { badgeStatus } from '../workout/badges';
import { allSteps } from '../workout/flow';
import { initialStreak } from '../workout/streak';
import type { WorkoutRecord } from '../workout/types';

import { isEmail, sendEmailCode, verifyEmailCode } from './auth';
import { normalizeReferral } from './store';
import { buildSyncPlan, runSync, stableId, type SyncInput } from './sync';

jest.mock('@/lib/supabase', () => ({ ensureSession: jest.fn(async () => true) }));

const LIBRARY = (seed.exercises as SeedExercise[]).map(fromSeed);

const profile = (patch: Partial<OnboardingData> = {}): OnboardingData => ({
  ...initialOnboarding(),
  units: 'imperial',
  birthMonth: 3,
  birthYear: 1983,
  sex: 'f',
  mainGoals: ['look'],
  location: 'home',
  minutes: 30,
  daysPerWeek: 3,
  equipment: ['dumbbells'],
  muscleGoals: [
    { muscleKey: 'upperChest', goal: 'grow' },
    { muscleKey: 'glutes', goal: 'firm' },
  ],
  painAreas: ['knee'],
  ...patch,
});

function finishedWorkout(p: OnboardingData, endedAt = '2026-09-25T18:00:00.000Z'): WorkoutRecord {
  const session = generateSession(inputFromProfile(p, LIBRARY, true)!);
  const logs = allSteps(session.items).map((s) => ({
    itemId: s.item.id,
    exerciseId: s.item.exerciseId,
    setNo: s.setNo,
    reps: 10,
    loggedAt: endedAt,
  }));
  return {
    id: uuid(),
    kind: 'regular',
    createdAt: endedAt,
    startedAt: endedAt,
    endedAt,
    status: 'done',
    session,
    logs,
    skipped: [],
    swaps: [],
    pains: [],
  };
}

const allIds = new Map(LIBRARY.map((e) => [e.slug, uuid()]));

function input(patch: Partial<SyncInput> = {}): SyncInput {
  const p = profile();
  return {
    userId: uuid(),
    profileId: uuid(),
    onboarding: p,
    restrictions: [
      {
        id: uuid(),
        area: 'shoulder',
        side: 'right',
        source: 'pain_report',
        active: true,
        createdAt: 'x',
      },
    ],
    workouts: [finishedWorkout(p)],
    streak: { ...initialStreak(), current: 2, best: 2, lastActive: '2026-09-25' },
    activity: { upperChest: { lastPrimaryAt: 'x', sets7d: 3 } },
    badges: ['first_workout'],
    exerciseIds: allIds,
    library: LIBRARY,
    ...patch,
  };
}

describe('sync plan', () => {
  it('maps the profile, safety answers, goals and restrictions', () => {
    const plan = buildSyncPlan(input());
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.profile).toMatchObject({
      birth_year: 1983,
      mode: 'adult',
      body_band: 'adult',
      sex: 'f',
    });
    expect(plan.health).toMatchObject({ pain_areas: ['knee'], red_flag: false });
    expect(plan.preferences).toMatchObject({ location: 'home', minutes: 30, days_per_week: 3 });
    expect(plan.muscleGoals.map((g) => g.priority)).toEqual([1, 2]);
    expect(plan.restrictions[0]).toMatchObject({
      area: 'shoulder',
      side: 'right',
      source: 'pain_report',
    });
    expect(plan.streak).toMatchObject({ current: 2, best: 2, freezes_available: 0 });
    expect(plan.badges).toEqual([{ profile_id: plan.profile.id, key: 'first_workout' }]);
  });

  it('copies finished workouts with database exercise ids, items and logs', () => {
    const i = input();
    const plan = buildSyncPlan(i);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.sessions).toHaveLength(1);
    const s = plan.sessions[0];
    expect(s.session).toMatchObject({ id: i.workouts[0].id, status: 'done', kind: 'regular' });
    expect(s.items).toHaveLength(i.workouts[0].session.items.length);
    expect(s.items.every((row) => isUuid(String(row.exercise_id)))).toBe(true);
    const itemIds = new Set(s.items.map((row) => row.id));
    expect(s.logs.every((l) => itemIds.has(l.session_item_id))).toBe(true);
    expect(s.items.map((row) => row.order)).toEqual(s.items.map((_, n) => n));
  });

  it('skips workouts whose exercises the database does not release (drafts)', () => {
    const plan = buildSyncPlan(input({ exerciseIds: new Map() }));
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.sessions).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it('never copies a workout twice, or one still in progress', () => {
    const i = input();
    i.workouts = [
      { ...i.workouts[0], syncedAt: '2026-09-25T19:00:00Z' },
      { ...i.workouts[0], id: uuid(), status: 'active' },
    ];
    const plan = buildSyncPlan(i);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.sessions).toHaveLength(0);
  });

  it('never syncs a child profile from the phone (guardian flow, Phase 6)', () => {
    expect(buildSyncPlan(input({ onboarding: profile({ birthYear: 2015 }) }))).toBe('child');
    expect(buildSyncPlan(input({ onboarding: profile({ birthYear: undefined }) }))).toBe(
      'no_profile',
    );
  });

  const progress = {
    checkins: [
      {
        id: uuid(),
        takenAt: '2026-09-25T10:00:00.000Z',
        strength: [],
        waistCm: 84,
        weightKg: 70,
        whtr: 0.5,
        bmi: 24.2,
      },
    ],
    repairResults: [
      { testKey: 'single_leg_balance', left: 22, right: 9, testedAt: '2026-09-25T10:00:00.000Z' },
    ],
    repairPlan: {
      createdAt: '2026-09-25T10:00:00.000Z',
      weeks: 6,
      sessionsPerWeek: 2,
      focus: [{ muscleKey: 'glutes', goal: 'balance' as const }],
      retestAt: '2026-11-06T10:00:00.000Z',
    },
  };

  it('copies check-ins and Repair; body measurements only for adults', () => {
    const adult = buildSyncPlan(input({ progress }));
    if (typeof adult === 'string') throw new Error(adult);
    expect(adult.checkins[0]).toMatchObject({ waist_cm: 84, weight_kg: 70, whtr: 0.5, bmi: 24.2 });
    expect(adult.repairResults[0]).toMatchObject({ left_value: 22, right_value: 9 });
    expect(adult.repairPlans[0]).toMatchObject({ weeks: 6, sessions_per_week: 2 });
    expect(JSON.stringify(adult)).not.toMatch(/photo|uri/i);

    const teen = buildSyncPlan(input({ progress, onboarding: profile({ birthYear: 2011 }) }));
    if (typeof teen === 'string') throw new Error(teen);
    expect(teen.checkins[0]).toMatchObject({
      waist_cm: null,
      weight_kg: null,
      whtr: null,
      bmi: null,
    });
    expect(teen.repairResults).toHaveLength(1);

    const again = buildSyncPlan(input({ progress, profileId: adult.profile.id as string }));
    if (typeof again === 'string') throw new Error(again);
    expect(again.repairResults[0].id).toBe(adult.repairResults[0].id);
  });

  it('copies movement pain reports, with the recovery level', () => {
    const plan = buildSyncPlan(
      input({
        movementPain: [
          {
            id: uuid(),
            area: 'shoulder',
            joints: ['shoulder'],
            side: 'right',
            painful: ['shoulder.abduction'],
            painFree: ['shoulder.flexion'],
            score: 4,
            duration: '2_6_weeks',
            active: true,
            createdAt: '2026-09-20T10:00:00.000Z',
            checks: [],
            retests: [],
          },
        ],
      }),
    );
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.movementPains[0]).toMatchObject({
      area: 'shoulder',
      side: 'right',
      painful: ['shoulder.abduction'],
      pain_free: ['shoulder.flexion'],
      level: 1,
    });
  });

  it('keeps single-row ids stable per profile', () => {
    const id = uuid();
    expect(stableId(id, 'health')).toBe(stableId(id, 'health'));
    expect(stableId(id, 'health')).not.toBe(stableId(uuid(), 'health'));
    expect(isUuid(stableId(id, 'health'))).toBe(true);
  });
});

describe('email sign-up', () => {
  const client = (overrides: Record<string, jest.Mock> = {}) =>
    ({
      auth: {
        updateUser: jest.fn(async () => ({ error: null })),
        signInWithOtp: jest.fn(async () => ({ error: null })),
        verifyOtp: jest.fn(async () => ({ error: null })),
        ...overrides,
      },
    }) as never;

  it('upgrades the anonymous user with the email', async () => {
    const c = client();
    expect(await sendEmailCode(c, ' Me@Example.com ')).toEqual({ status: 'sent', mode: 'upgrade' });
    expect((c as { auth: { updateUser: jest.Mock } }).auth.updateUser).toHaveBeenCalledWith({
      email: 'me@example.com',
    });
    expect(await verifyEmailCode(c, 'me@example.com', '123 456', 'upgrade')).toBe('ok');
    expect((c as { auth: { verifyOtp: jest.Mock } }).auth.verifyOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      token: '123456',
      type: 'email_change',
    });
  });

  it('signs in instead when the email already has an account', async () => {
    const c = client({ updateUser: jest.fn(async () => ({ error: { code: 'email_exists' } })) });
    expect(await sendEmailCode(c, 'me@example.com')).toEqual({ status: 'sent', mode: 'signin' });
    await verifyEmailCode(c, 'me@example.com', '123456', 'signin');
    expect((c as { auth: { verifyOtp: jest.Mock } }).auth.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email' }),
    );
  });

  it('rejects bad input and reports offline and rate limits', async () => {
    expect(isEmail('nope')).toBe(false);
    expect(await sendEmailCode(client(), 'nope')).toEqual({ status: 'invalid' });
    expect(await sendEmailCode(null, 'me@example.com')).toEqual({ status: 'offline' });
    const limited = client({ updateUser: jest.fn(async () => ({ error: { status: 429 } })) });
    expect(await sendEmailCode(limited, 'me@example.com')).toEqual({ status: 'rate_limited' });
    expect(await verifyEmailCode(client(), 'me@example.com', '12', 'upgrade')).toBe('wrong_code');
    const expired = client({
      verifyOtp: jest.fn(async () => ({ error: { code: 'otp_expired' } })),
    });
    expect(await verifyEmailCode(expired, 'me@example.com', '123456', 'upgrade')).toBe(
      'wrong_code',
    );
  });
});

describe('referral codes', () => {
  it('accepts only the database format', () => {
    expect(normalizeReferral(' ab3def7 ')).toBe('AB3DEF7');
    expect(normalizeReferral('AB1DEF7')).toBeNull(); // 1 is ambiguous
    expect(normalizeReferral('SHORT')).toBeNull();
    expect(normalizeReferral(undefined)).toBeNull();
  });
});

describe('notifications plan', () => {
  const prefs = {
    reminders: true,
    reminderTime: '18:30',
    streakSaver: true,
    streakSaverTime: '20:00',
  };
  const now = new Date(2026, 8, 26, 12, 0); // Saturday noon

  it('reminds on training days at the chosen time', () => {
    const plan = planNotifications({ prefs, daysPerWeek: 3, streak: 0, lastActive: null, now });
    expect(plan).toEqual(
      TRAINING_DAYS[3].map((d) => ({
        id: `reminder-${d}`,
        kind: 'reminder',
        weekday: d + 1,
        hour: 18,
        minute: 30,
      })),
    );
  });

  it('nudges tonight only when the streak is alive and nothing is logged today', () => {
    const tonight = planNotifications({
      prefs: { ...prefs, reminders: false },
      daysPerWeek: 3,
      streak: 4,
      lastActive: '2026-09-25',
      now,
    });
    expect(tonight).toHaveLength(1);
    expect(tonight[0]).toMatchObject({ kind: 'streak_saver', streak: 4 });
    expect((tonight[0] as { date: Date }).date.getDate()).toBe(26);

    const trained = planNotifications({
      prefs: { ...prefs, reminders: false },
      daysPerWeek: 3,
      streak: 4,
      lastActive: '2026-09-26',
      now,
    });
    expect((trained[0] as { date: Date }).date.getDate()).toBe(27);

    expect(
      planNotifications({
        prefs: { ...prefs, reminders: false },
        daysPerWeek: 3,
        streak: 0,
        lastActive: null,
        now,
      }),
    ).toEqual([]);
  });

  it('schedules nothing when both are off', () => {
    const off = { ...prefs, reminders: false, streakSaver: false };
    expect(
      planNotifications({ prefs: off, daysPerWeek: 5, streak: 9, lastActive: null, now }),
    ).toEqual([]);
  });
});

describe('badges', () => {
  it('earns first workout, tracks streak and full-body progress, and spots a PR', () => {
    const p = profile();
    const w1 = finishedWorkout(p, '2026-09-20T18:00:00.000Z');
    const w2 = finishedWorkout(p, '2026-09-24T18:00:00.000Z');
    const loaded = w1.logs.find(
      (l) => w1.session.items.find((i) => i.id === l.itemId)?.role === 'main',
    )!;
    w1.logs = w1.logs.map((l) => (l === loaded ? { ...l, load: 20, unit: 'lb' } : l));
    w2.logs = w2.logs.map((l) =>
      l.exerciseId === loaded.exerciseId && l.setNo === 1 ? { ...l, load: 25, unit: 'lb' } : l,
    );
    const now = new Date('2026-09-25T12:00:00Z');
    const status = badgeStatus([w1, w2], { ...initialStreak(), current: 3, best: 3 }, LIBRARY, now);
    const byKey = Object.fromEntries(status.map((b) => [b.key, b]));
    expect(byKey.first_workout.earned).toBe(true);
    expect(byKey.first_pr.earned).toBe(true);
    expect(byKey.streak_7).toMatchObject({ earned: false, progress: [3, 7] });
    expect(byKey.full_body_week.progress![1]).toBe(4);
    expect(badgeStatus([], initialStreak(), LIBRARY, now).every((b) => !b.earned)).toBe(true);
  });
});

describe('runSync', () => {
  type Call = { table: string; op: string; rows?: unknown };
  function fakeClient(
    opts: { anonymous?: boolean; existingProfile?: string; failOn?: string } = {},
  ) {
    const calls: Call[] = [];
    const result = (table: string, op: string) => ({
      error: opts.failOn === table ? { message: 'boom' } : null,
    });
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1', is_anonymous: !!opts.anonymous } } }),
      },
      from: (table: string) => ({
        select: () => ({
          in: async () => ({
            data: [...allIds].map(([slug, id]) => ({ slug, id })),
            error: null,
          }),
          eq: () => ({
            maybeSingle: async () => ({
              data: opts.existingProfile ? { id: opts.existingProfile } : null,
              error: null,
            }),
          }),
        }),
        upsert: async (rows: unknown) => {
          calls.push({ table, op: 'upsert', rows });
          return result(table, 'upsert');
        },
        insert: async (rows: unknown) => {
          calls.push({ table, op: 'insert', rows });
          return result(table, 'insert');
        },
        delete: () => ({
          eq: async () => {
            calls.push({ table, op: 'delete' });
            return { error: null };
          },
        }),
      }),
    };
    return { client: client as never, calls };
  }

  it('writes profile first, then the workout with its items and logs', async () => {
    const { client, calls } = fakeClient();
    const i = input();
    const r = await runSync(
      client,
      (userId, ids) => buildSyncPlan({ ...i, userId, exerciseIds: ids }),
      ['x'],
    );
    expect(r).toEqual({ status: 'ok', synced: [i.workouts[0].id], skipped: [] });
    expect(calls[0]).toMatchObject({ table: 'profiles', op: 'upsert' });
    const order = calls.map((c) => `${c.op}:${c.table}`);
    expect(order.indexOf('upsert:sessions')).toBeLessThan(order.indexOf('insert:session_items'));
    expect(order.indexOf('insert:session_items')).toBeLessThan(order.indexOf('insert:set_logs'));
  });

  it('does nothing for an anonymous user and stops at the first error', async () => {
    const anon = fakeClient({ anonymous: true });
    expect(await runSync(anon.client, () => 'no_profile', [])).toEqual({
      status: 'skipped',
      reason: 'no_account',
    });
    const failing = fakeClient({ failOn: 'health_screen' });
    const i = input();
    const r = await runSync(
      failing.client,
      (u, ids) => buildSyncPlan({ ...i, userId: u, exerciseIds: ids }),
      [],
    );
    expect(r).toEqual({ status: 'error', step: 'health_screen' });
    expect(failing.calls.some((c) => c.table === 'sessions')).toBe(false);
  });

  it("reuses the account's existing profile row when signing in", async () => {
    const { client, calls } = fakeClient({ existingProfile: 'p-old' });
    const i = input();
    await runSync(
      client,
      (u, ids, existing) =>
        buildSyncPlan({ ...i, userId: u, exerciseIds: ids, profileId: existing ?? i.profileId }),
      [],
    );
    expect((calls[0].rows as { id: string }).id).toBe('p-old');
  });
});
