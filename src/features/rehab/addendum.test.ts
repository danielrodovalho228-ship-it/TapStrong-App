/**
 * Phase 30 addendum (§6): the shoulder program next to the regular workout —
 * the daily rhythm (stretches every day, two blocks taking turns, 3 times a
 * week each, at most 12 exercises a day), missed exercises, "sem duplicar",
 * the protected-shoulder mode in the generator and the sleeper reminders.
 */
import seed from '../../../supabase/seed/exercises.json';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { blockReason, generateSession, type GeneratorInput } from '../generator';
import { rangeFor } from '../generator/filters';
import { planNotifications } from '../notifications/plan';
import type { NotificationPrefs } from '../account/store';
import { safetyRefresh, workoutInput } from '../workout/safety';
import type { WorkoutRecord } from '../workout/types';
import { addDays } from '@/lib/dates';

import { readFileSync } from 'fs';
import { join } from 'path';

import qc from '../../../assets/prototype/qc.json';
import catalog from '../../../supabase/seed/joint_movements.json';

import { careDay, careWeek, dailyLayout, dailyPlan, weekCounts, weekdayIndex } from './daily';
import { buildProgramSession, SHOULDER_PROGRAM as P } from './programs';
import { careMode, careProtection, SHOULDER_MOVES, withCare, withoutCare } from './protect';
import type { ProgramRun } from './store';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const MONDAY = '2026-10-05';
const slugOfN = (n: number) => P.exercises.find((x) => x.n === n)!.slug;
const STRENGTH = P.exercises.filter((x) => x.block !== 'stretch');

/** A finished workout on a day that logged these exercises. */
function workoutOn(day: string, slugs: string[], program = true): WorkoutRecord {
  return {
    id: `w-${day}-${slugs.length}`,
    kind: program ? 'repair' : 'regular',
    status: 'done',
    createdAt: `${day}T08:00:00`,
    startedAt: `${day}T08:00:00`,
    endedAt: `${day}T09:00:00`,
    session: {
      items: [],
      minutes: 20,
      warmupMinutes: 0,
      cooldownMinutes: 0,
      estimatedMinutes: 20,
      notes: [],
      ...(program ? { program: { id: P.id, session: 'standing', week: 1 } } : {}),
    },
    logs: slugs.map((slug, i) => ({
      itemId: `i${i}`,
      exerciseId: bySlug.get(slug)!.id,
      setNo: 1,
      reps: 10,
      loggedAt: `${day}T08:30:00`,
    })),
    pains: [],
    skipped: [],
    swaps: [],
  } as unknown as WorkoutRecord;
}

/** Runs a week day by day: `skip` days do nothing; the rest do exactly the plan. */
function simulate(skip: number[] = [], week = P.daily.week) {
  const workouts: WorkoutRecord[] = [];
  const days: { block: string; size: number; numbers: number[]; nextWeek: number[] }[] = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(MONDAY, d);
    const counts = weekCounts(workouts, P, LIBRARY, MONDAY, day);
    const plan = dailyPlan(P, day, counts, undefined, week);
    const size = 5 + plan.numbers.length;
    days.push({ block: plan.block, size, numbers: plan.numbers, nextWeek: plan.nextWeek });
    if (skip.includes(d)) continue;
    const stretches = P.exercises.filter((x) => x.block === 'stretch').map((x) => x.slug);
    workouts.push(workoutOn(day, [...stretches, ...plan.numbers.map(slugOfN)]));
  }
  return { days, counts: weekCounts(workouts, P, LIBRARY, MONDAY, addDays(MONDAY, 7)) };
}

describe('the daily rhythm (§6.2)', () => {
  it('Monday is block A (standing: 6–11), Tuesday block B (bench and mat: 12–18)', () => {
    expect(weekdayIndex(MONDAY)).toBe(0);
    expect(dailyPlan(P, MONDAY, {})).toMatchObject({
      block: 'standing',
      numbers: [6, 7, 8, 9, 10, 11],
      catchUp: [],
    });
    const done = Object.fromEntries([6, 7, 8, 9, 10, 11].map((n) => [slugOfN(n), 1]));
    expect(dailyPlan(P, addDays(MONDAY, 1), done)).toMatchObject({
      block: 'floor',
      numbers: [12, 13, 14, 15, 16, 17, 18],
    });
  });

  it('a standard week: A B A B A B, Sunday stretches only, every exercise 3 times, ≤ 12 a day', () => {
    const { days, counts } = simulate();
    expect(days.map((d) => d.block)).toEqual([
      'standing',
      'floor',
      'standing',
      'floor',
      'standing',
      'floor',
      'stretch',
    ]);
    for (const x of STRENGTH) expect(counts[x.slug]).toBe(3);
    for (const d of days) expect(d.size).toBeLessThanOrEqual(12);
    // Stretches every day.
    expect(counts.sleeper_stretch).toBe(7);
  });

  it('the session: warm-up, stretches, the block, then the pendulum again (sleeper in its breaks)', () => {
    const s = buildProgramSession(P, dailyLayout(P, dailyPlan(P, MONDAY, {})), {
      library: LIBRARY,
      affected: 'right',
      week: 1,
    });
    expect(s.missing).toEqual([]);
    expect(s.items[0].block).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
    expect(s.items.filter((i) => i.block === 'stretch_end')).toHaveLength(1);
    expect(s.program).toEqual({ id: P.id, session: 'standing', week: 1 });
  });

  it('Sunday with nothing missed: stretches only, no warm-up needed', () => {
    const counts = Object.fromEntries(STRENGTH.map((x) => [x.slug, 3]));
    const plan = dailyPlan(P, addDays(MONDAY, 6), counts);
    expect(plan).toMatchObject({ block: 'stretch', numbers: [], nextWeek: [] });
    expect(dailyLayout(P, plan).warmup).toBe(false);
  });

  it('swapping the day (B on a gym Monday) re-plans the week and keeps 3 each', () => {
    expect(dailyPlan(P, MONDAY, {}, 'floor').block).toBe('floor');
    const floor = Object.fromEntries([12, 13, 14, 15, 16, 17, 18].map((n) => [slugOfN(n), 1]));
    expect(dailyPlan(P, addDays(MONDAY, 1), floor).block).toBe('standing');
  });
});

describe("the day's dose (Daniel, Oct 2)", () => {
  const counts = (ns: number[]) => Object.fromEntries(ns.map((n) => [slugOfN(n), 1]));
  const day = (
    date: string,
    done: Record<string, number>,
    full = false,
    affected: 'right' | 'both' = 'right',
  ) =>
    buildProgramSession(P, dailyLayout(P, dailyPlan(P, date, done), full), {
      library: LIBRARY,
      affected,
      week: 1,
    });
  const item = (s: ReturnType<typeof day>, slug: string) =>
    s.items.filter((i) => i.exerciseId === bySlug.get(slug)!.id);

  it('stretches 2 and 4: 2 holds of 30 s, affected side only; pendulum 1 min; no sleeper', () => {
    const s = day(MONDAY, {});
    // Stretch 3 reaches behind the back: never (Phase 32 A1).
    expect(item(s, 'stick_internal_rotation_stretch')).toEqual([]);
    for (const slug of ['crossover_arm_stretch', 'stick_external_rotation_stretch']) {
      const [x] = item(s, slug);
      expect([slug, x.sets, x.holdSeconds, x.sides]).toEqual([slug, 2, [30, 30], ['right']]);
    }
    const [pendulum] = item(s, 'pendulum_swing');
    expect([pendulum.sets, pendulum.holdSeconds, pendulum.sides]).toEqual([1, [60, 60], ['right']]);
    expect(item(s, 'sleeper_stretch')).toEqual([]);
    // Both shoulders affected: both sides, still 2 holds each.
    expect(item(day(MONDAY, {}, false, 'both'), 'crossover_arm_stretch')[0].sets).toBe(4);
  });

  it('blocks A and B: 2 sets instead of 3; a warm-up first, a cool-down last', () => {
    for (const s of [day(MONDAY, {}), day(addDays(MONDAY, 1), counts([6, 7, 8, 9, 10, 11]))]) {
      const strength = s.items.filter((i) => i.block === 'band' || i.block === 'dumbbell');
      for (const i of strength) if (i.reps) expect(i.sets / (i.sides?.length ?? 1)).toBe(2);
      expect(s.items[0].role).toBe('warmup');
      expect(s.items.at(-1)!.role).toBe('cooldown');
    }
  });

  it('about a third of the full dose: ~21 min for block A, ~24 for block B (estimate shown on the card)', () => {
    const a = day(MONDAY, {});
    const b = day(addDays(MONDAY, 1), counts([6, 7, 8, 9, 10, 11]));
    expect(a.minutes).toBe(21);
    expect(b.minutes).toBe(24);
    const full = day(MONDAY, {}, true);
    expect(item(full, 'sleeper_stretch')).toHaveLength(2);
    expect(item(full, 'crossover_arm_stretch')[0].sets).toBe(8);
    expect(full.minutes).toBeGreaterThan(2 * a.minutes);
  });
});

describe('a missed day (§6.3)', () => {
  it('moves what can no longer fit 3 times to the next days, never more than 12 a day', () => {
    const { days, counts } = simulate([0, 1]);
    for (const d of days) expect(d.size).toBeLessThanOrEqual(12);
    // Nothing is ever done more than 3 times: no double load.
    for (const x of STRENGTH) expect(counts[x.slug] ?? 0).toBeLessThanOrEqual(3);
    // With two days lost, some catch-up happens and the rest waits for next week.
    expect(days.some((d) => d.numbers.length > 7 || d.block === 'stretch')).toBe(true);
    const done = STRENGTH.reduce((n, x) => n + (counts[x.slug] ?? 0), 0);
    expect(done).toBeGreaterThan(13 * 2);
  });

  it('Sunday takes the leftovers up to the cap; what does not fit goes to next week', () => {
    const counts = Object.fromEntries(STRENGTH.map((x) => [x.slug, 1]));
    const plan = dailyPlan(P, addDays(MONDAY, 6), counts);
    expect(plan.numbers).toHaveLength(7);
    expect(plan.catchUp).toEqual(plan.numbers);
    expect(plan.nextWeek).toHaveLength(13 - 7);
  });
});

describe('"sem duplicar" (§6.4)', () => {
  it('a band row in the regular workout counts for the program this week', () => {
    const workouts = [workoutOn(MONDAY, ['band_row', 'goblet_squat'], false)];
    const counts = weekCounts(workouts, P, LIBRARY, MONDAY, addDays(MONDAY, 1));
    expect(counts).toEqual({ band_row: 1 });
    // Last week's workouts don't count.
    expect(weekCounts(workouts, P, LIBRARY, addDays(MONDAY, 7), addDays(MONDAY, 8))).toEqual({});
  });
});

const run = (patch: Partial<ProgramRun> = {}): ProgramRun => ({
  side: 'right',
  startedAt: MONDAY,
  safetyAcceptedAt: 'now',
  maintenance: false,
  increased: {},
  review: {},
  cleared: null,
  releasedAt: null,
  sleeperReminders: false,
  ...patch,
});

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'shoulders', goal: 'strengthen' }],
  exercisesPerSession: 6,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: MONDAY,
  now: `${MONDAY}T12:00:00Z`,
};
const protectedInput = (r: ProgramRun) => withCare(base, careProtection({ [P.id]: r }, MONDAY));
const ex = (slug: string) => bySlug.get(slug)!;
const movesShoulder = (e: Exercise) =>
  e.joints.some((j) => j.joint === 'shoulder' && j.range !== 'isometric');

describe('protected shoulder in the regular workout (§6.4)', () => {
  it('the shoulder movements match the movement catalog', () => {
    expect([...SHOULDER_MOVES]).toEqual(catalog.joints.shoulder.movements);
  });

  it('not cleared (or not answered): every move of the shoulder is left out; legs and core stay', () => {
    for (const r of [run({ cleared: false }), run()]) {
      expect(careMode(r, MONDAY)).toBe('off');
      const input = protectedInput(r);
      for (const slug of ['dumbbell_shoulder_press', 'barbell_bench_press', 'band_row', 'pull_up'])
        expect(blockReason(ex(slug), input)).toBe('contraindication');
      expect(blockReason(ex('goblet_squat'), input)).toBeNull();
      const s = generateSession({ ...input, muscleGoals: [] });
      const used = s.items.map((i) => LIBRARY.find((e) => e.id === i.exerciseId)!);
      expect(used.filter((e) => e.parts.includes('main')).some(movesShoulder)).toBe(false);
    }
  });

  it('cleared: no overhead, pull-ups, pulldowns or dips; side raises to shoulder height; bench stays', () => {
    const input = protectedInput(run({ cleared: true }));
    for (const slug of [
      'dumbbell_shoulder_press',
      'machine_shoulder_press',
      'pull_up',
      'chin_up',
      'lat_pulldown',
      'parallel_bar_dip',
      'bench_dip',
    ])
      expect([slug, blockReason(ex(slug), input)]).toEqual([slug, 'painful_movement']);
    expect(blockReason(ex('dumbbell_lateral_raise'), input)).toBeNull();
    expect(rangeFor(ex('dumbbell_lateral_raise'), input)).toBe('reduced');
    expect(blockReason(ex('barbell_bench_press'), input)).toBeNull();
    expect(blockReason(ex('band_row'), input)).toBeNull();
  });

  it('a doctor-first shoulder stays after the care rules come off', () => {
    const own = { ...base, hardRestrictions: ['shoulder'] };
    const input = withCare(own, careProtection({ [P.id]: run() }, MONDAY));
    expect(withoutCare(input).hardRestrictions).toEqual(['shoulder']);
    expect(withoutCare(protectedInput(run())).hardRestrictions).toEqual([]);
  });

  it("the program's own sessions are never touched by the protection", () => {
    const input = protectedInput(run());
    const session = buildProgramSession(P, 'C', { library: LIBRARY, affected: 'right', week: 1 });
    const w = { ...workoutOn(MONDAY, []), status: 'planned', session } as WorkoutRecord;
    expect(safetyRefresh(w, input)).toEqual({ kind: 'ok' });
    expect(workoutInput(w, input).care).toBeUndefined();
  });

  it('after the physio releases it (§6.5): 2 weeks of the cleared rules, then nothing', () => {
    const released = run({ releasedAt: MONDAY, maintenance: true });
    expect(careMode(released, addDays(MONDAY, 13))).toBe('returning');
    expect(careProtection({ [P.id]: released }, addDays(MONDAY, 13)).limits).toHaveLength(2);
    expect(careMode(released, addDays(MONDAY, 14))).toBe('none');
    expect(careProtection({ [P.id]: released }, addDays(MONDAY, 14))).toEqual({
      hard: [],
      limits: [],
    });
  });
});

describe('sleeper reminders (§6.2)', () => {
  it('3 a day, morning, afternoon and evening, only when turned on', () => {
    const prefs = {
      reminders: false,
      reminderTime: '18:00',
      streakSaver: false,
      streakSaverTime: '20:00',
    } as NotificationPrefs;
    const common = { prefs, daysPerWeek: 3, streak: 0, lastActive: null, now: new Date() };
    expect(planNotifications(common)).toEqual([]);
    const plan = planNotifications({
      ...common,
      careStretch: [{ programId: P.id, hours: P.daily.sleeperHours }],
    });
    expect(plan.map((p) => p.kind === 'care_stretch' && p.hour)).toEqual([9, 15, 21]);
  });
});

/** What the manifest gives each slug and sex: the clip and poster files (assets are stubs in Jest). */
const MANIFEST = readFileSync(join(__dirname, '../../../assets/prototype/videos.js'), 'utf8');
function shown(slug: string, sex: 'f' | 'm') {
  const line = MANIFEST.split('\n').find((l) => l.startsWith(`  ${JSON.stringify(slug)}:`)) ?? '';
  return {
    clip: line.includes(`${sex}: require("./${slug}.`),
    poster: line.includes(`${sex}: require("./posters/`),
  };
}

describe('shoulder clips that failed QC (Daniel, Oct 2)', () => {
  it('never reach the app: no clip and no poster, so the player shows the body map and the steps', () => {
    const shoulder = Object.keys(qc.suspect).filter((k) =>
      P.exercises.some((x) => k.startsWith(`${x.slug}.`)),
    );
    expect(shoulder.length).toBeGreaterThanOrEqual(22);
    for (const key of shoulder) {
      const [slug, sex] = key.split('.') as [string, 'f' | 'm'];
      expect([key, shown(slug, sex)]).toEqual([key, { clip: false, poster: false }]);
    }
  });
});

describe('posters before the clip (Daniel, Oct 2)', () => {
  it('a checked image shows alone; a rejected image or a failed clip never does', () => {
    const { posterSuspect, suspect } = qc as {
      posterSuspect: Record<string, string>;
      suspect: Record<string, string>;
    };
    expect(Object.keys(posterSuspect).length).toBeGreaterThan(0);
    for (const key of [...Object.keys(posterSuspect), ...Object.keys(suspect)]) {
      const [slug, sex] = key.split('.') as [string, 'f' | 'm'];
      const s = shown(slug, sex);
      if (!s.clip) expect([key, s.poster]).toEqual([key, false]);
    }
    // rx_side_lying_er: the clip failed twice, the checked images show ("só pôster").
    expect(shown('rx_side_lying_er', 'f')).toEqual({ clip: false, poster: true });
    expect(shown('rx_side_lying_er', 'm')).toEqual({ clip: false, poster: true });
  });
});

describe('the longer block on rest days (Daniel, Oct 3)', () => {
  // Monday first; the main plan trains Mon, Wed, Fri.
  const MWF = [true, false, true, false, true, false, false];

  it('block B (~26 min) lands on rest days, block A on training days, 3 each', () => {
    const week = careWeek(P, MWF);
    expect(week).toEqual([
      'standing',
      'floor',
      'standing',
      'floor',
      'standing',
      'floor',
      'stretch',
    ]);
    const week4 = careWeek(P, [true, true, false, true, true, false, false]);
    expect(week4.filter((b) => b === 'floor')).toHaveLength(3);
    expect(week4.filter((b) => b === 'standing')).toHaveLength(3);
    // Both rest days (Wed, Sat) get B; the third B is a training day.
    expect(week4[2]).toBe('floor');
    expect(week4[5]).toBe('floor');
    expect(week4[6]).toBe('stretch');
  });

  it('few rest days: B is spread out; deterministic', () => {
    const six = Array(7).fill(true);
    const week = careWeek(P, six);
    expect(week).toEqual(careWeek(P, six));
    const floors = week.flatMap((b, i) => (b === 'floor' ? [i] : []));
    expect(floors).toHaveLength(3);
    for (let i = 1; i < floors.length; i++) expect(floors[i] - floors[i - 1]).toBeGreaterThan(1);
  });

  it('a full week on the fitted rhythm still does every exercise 3 times', () => {
    const week = careWeek(P, [true, true, false, true, true, false, false]);
    const { days, counts } = simulate([], week);
    expect(days[2].block).toBe('floor');
    expect(days[1].block).toBe('standing');
    for (const x of STRENGTH) expect(counts[x.slug]).toBe(3);
    for (const d of days) expect(d.size).toBeLessThanOrEqual(P.daily.cap);
  });
});

describe('strengthening after the workout on training days (Daniel, Oct 3)', () => {
  const plan = dailyPlan(P, MONDAY, {});
  const none = new Set<string>();

  it('a training day: stretches first, the block after', () => {
    const day = careDay(P, plan, { trainingDay: true, workoutSlugs: none });
    expect(day.first.block).toBe('stretch');
    expect(day.first.numbers).toEqual([]);
    expect(day.after).toEqual(plan.numbers);
  });

  it('"before", or a day without training: the whole block in one session', () => {
    for (const o of [
      { trainingDay: true, timing: 'before' as const },
      { trainingDay: false, timing: 'after' as const },
    ]) {
      const day = careDay(P, plan, { ...o, workoutSlugs: none });
      expect(day.first.numbers).toEqual(plan.numbers);
      expect(day.after).toEqual([]);
    }
  });

  it('an exercise already in today’s workout is left out, never twice', () => {
    const shared = slugOfN(plan.numbers[0]);
    for (const timing of ['before', 'after'] as const) {
      const day = careDay(P, plan, { trainingDay: true, timing, workoutSlugs: new Set([shared]) });
      expect(day.inWorkout).toEqual([plan.numbers[0]]);
      expect([...day.first.numbers, ...day.after]).not.toContain(plan.numbers[0]);
    }
  });
});
