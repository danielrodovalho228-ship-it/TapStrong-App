import seed from '../../../supabase/seed/exercises.json';
import repairSeed from '../../../supabase/seed/repair_tests.json';

import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { activitySummary } from '../family/profiles';
import { generateSession, type GeneratorInput } from '../generator';
import { MUSCLE_KEYS } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import {
  buildRepairPlan,
  findings,
  grade,
  PLAN_WEEKS,
  testsFor,
  type RepairTest,
} from '../repair/tests';
import { excludedCount, painSwaps } from '../restrictions/impact';
import { repairInput } from '../workout/plan';
import type { SetLog, WorkoutRecord } from '../workout/types';

import {
  bmi,
  checkinDue,
  coachNote,
  measurementsAllowed,
  strengthChanges,
  whtr,
  whtrBand,
} from './checkin';
import { chartMuscles, totals, weeklySets } from './stats';
import type { StrengthRow } from './store';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const TESTS = repairSeed.tests as RepairTest[];

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 40,
  mainGoals: ['look'],
  muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
  exercisesPerSession: 3,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

const SESSION = generateSession(base);
const MAIN = SESSION.items.find((i) => i.role === 'main')!;
const WARMUP = SESSION.items.find((i) => i.role === 'warmup')!;

function record(id: string, logs: SetLog[], patch: Partial<WorkoutRecord> = {}): WorkoutRecord {
  const at = logs[0]?.loggedAt ?? '2026-09-01T10:00:00.000Z';
  return {
    id,
    kind: 'regular',
    createdAt: at,
    startedAt: at,
    endedAt: at,
    status: 'done',
    session: SESSION,
    logs,
    skipped: [],
    swaps: [],
    pains: [],
    ...patch,
  };
}

const log = (loggedAt: string, patch: Partial<SetLog> = {}): SetLog => ({
  itemId: MAIN.id,
  exerciseId: MAIN.exerciseId,
  setNo: 1,
  reps: 10,
  loggedAt,
  ...patch,
});

const NOW = new Date('2026-09-28T12:00:00.000Z');

describe('progress stats', () => {
  it('counts finished workouts and main sets only', () => {
    const w = record('a', [
      log('2026-09-27T10:00:00.000Z'),
      log('2026-09-27T10:05:00.000Z', { setNo: 2 }),
      log('2026-09-27T09:55:00.000Z', { itemId: WARMUP.id, exerciseId: WARMUP.exerciseId }),
    ]);
    const active = record('b', [log('2026-09-27T11:00:00.000Z')], { status: 'active' });
    expect(totals([w, active])).toEqual({ workouts: 1, sets: 2 });
  });

  it('buckets main sets by calendar week for the trained muscle', () => {
    const muscle = LIBRARY.find((e) => e.id === MAIN.exerciseId)!.muscles.find(
      (m) => m.role === 'primary',
    )!.muscleKey;
    const w = record('a', [log('2026-09-27T10:00:00.000Z'), log('2026-09-15T10:00:00.000Z')]);
    const bars = weeklySets([w], LIBRARY, muscle, NOW, 0);
    expect(bars).toHaveLength(4);
    expect(bars.at(-1)).toEqual({ weekStart: '2026-09-27', sets: 1 });
    expect(bars.map((b) => b.sets)).toEqual([0, 1, 0, 1]);
    expect(chartMuscles([], [w], LIBRARY)[0]).toBeDefined();
    expect(chartMuscles(['glutes'], [w], LIBRARY)[0]).toBe('glutes');
  });
});

describe('check-in', () => {
  it('keeps body measurements to adults 18–59 (SPEC §2.3, QA R4)', () => {
    expect(measurementsAllowed('adult')).toBe(true);
    expect(measurementsAllowed('senior')).toBe(false); // QA R4 P2: adults 18–59 only
    expect(measurementsAllowed('teen')).toBe(false);
    expect(measurementsAllowed('child')).toBe(false);
  });

  it('is due 4 weeks after the first workout, then 4 weeks after the last check-in', () => {
    const w = record('a', [log('2026-08-30T10:00:00.000Z')]);
    expect(checkinDue([], [], NOW)).toBe(false);
    expect(checkinDue([w], [], NOW)).toBe(true);
    expect(checkinDue([w], [], new Date('2026-09-20T10:00:00.000Z'))).toBe(false);
    const c = { id: 'c', takenAt: '2026-09-20T10:00:00.000Z', strength: [] };
    expect(checkinDue([w], [c], NOW)).toBe(false);
  });

  it('compares the best set of week 1 with week 4', () => {
    const w1 = record('a', [
      log('2026-09-01T10:00:00.000Z', { load: 20, unit: 'kg', reps: 10 }),
      log('2026-09-01T10:05:00.000Z', { load: 15, unit: 'kg', reps: 10, setNo: 2 }),
    ]);
    const w4 = record('b', [log('2026-09-27T10:00:00.000Z', { load: 25, unit: 'kg', reps: 10 })]);
    const rows = strengthChanges([w1, w4], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'load', change: 25, first: { value: 20 } });
    // Only one of the two weeks: no row.
    expect(strengthChanges([w4], NOW)).toEqual([]);
  });

  it('computes WHtR, BMI and bands', () => {
    expect(whtr(84, 168)).toBe(0.5);
    expect(bmi(70, 170)).toBe(24.2);
    expect(whtrBand(0.49)).toBe('healthy');
    expect(whtrBand(0.55)).toBe('increased');
    expect(whtrBand(0.6)).toBe('high');
  });

  it('writes a deterministic coach note', () => {
    const up: StrengthRow = {
      exerciseId: 'x',
      kind: 'reps',
      first: { value: 8 },
      last: { value: 10 },
      change: 2,
    };
    expect(coachNote([up], -2)).toEqual({ key: 'waistAndStrength', waist: 2 });
    expect(coachNote([up], null)).toEqual({ key: 'strength' });
    expect(coachNote([], -1)).toEqual({ key: 'waist', waist: 1 });
    expect(coachNote([], null)).toEqual({ key: 'firstCheckin' });
    expect(coachNote([{ ...up, change: 0 }], 0.2)).toEqual({ key: 'steady' });
  });
});

describe('Repair', () => {
  it('uses only muscles from the database', () => {
    for (const t of TESTS) for (const m of t.focus.muscles) expect(MUSCLE_KEYS).toContain(m);
  });

  it('filters tests by position, pain areas and conditions', () => {
    const keys = (x: RepairTest[]) => x.map((t) => t.key);
    expect(keys(testsFor(TESTS, 'standing', []))).toHaveLength(TESTS.length);
    expect(keys(testsFor(TESTS, 'seated_only', []))).toEqual(['shoulder_reach']);
    expect(keys(testsFor(TESTS, 'standing', ['knee']))).not.toContain('squat');
    expect(keys(testsFor(TESTS, 'standing', ['recent_surgery']))).toEqual([]);
    expect(keys(testsFor(TESTS, 'standing', ['pregnant_postpartum']))).not.toContain('front_plank');
  });

  it('grades results by mode and side balance', () => {
    const t = (k: string) => TESTS.find((x) => x.key === k)!;
    const at = '2026-09-28T10:00:00.000Z';
    expect(grade(t('squat'), undefined, 'adult')).toBe('todo');
    expect(grade(t('squat'), { testKey: 'squat', value: 13, testedAt: at }, 'adult')).toBe('low');
    expect(grade(t('squat'), { testKey: 'squat', value: 13, testedAt: at }, 'senior')).toBe('good');
    const balance = { testKey: 'single_leg_balance', left: 30, right: 12, testedAt: at };
    expect(grade(t('single_leg_balance'), balance, 'adult')).toBe('uneven');
    const reach = { testKey: 'shoulder_reach', passLeft: true, passRight: false, testedAt: at };
    expect(grade(t('shoulder_reach'), reach, 'adult')).toBe('limited');

    const found = findings(TESTS, [balance, reach], 'adult');
    expect(found).toEqual([
      { testKey: 'single_leg_balance', grade: 'uneven', side: 'right' },
      { testKey: 'shoulder_reach', grade: 'limited', side: 'right' },
    ]);

    const plan = buildRepairPlan(TESTS, found, NOW)!;
    expect(plan.weeks).toBe(PLAN_WEEKS);
    expect(plan.focus).toEqual([
      { muscleKey: 'hips', goal: 'balance' },
      { muscleKey: 'glutes', goal: 'balance' },
      { muscleKey: 'shoulders', goal: 'mobility' },
      { muscleKey: 'upperBack', goal: 'mobility' },
    ]);
    expect(plan.retestAt).toBe('2026-11-09T12:00:00.000Z');
    expect(buildRepairPlan(TESTS, [], NOW)).toBeNull();
  });

  it('builds a short repair session that keeps warm-up and cool-down', () => {
    const s = generateSession(repairInput(base, [{ muscleKey: 'glutes', goal: 'strengthen' }], 15));
    expect(s.error).toBeUndefined();
    expect(s.items[0].role).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
    expect(s.items.some((i) => i.role === 'finisher')).toBe(false);
  });
});

describe('restrictions impact', () => {
  it('counts main exercises an area rules out and pain swaps', () => {
    const { excluded, total } = excludedCount(LIBRARY, 'shoulder');
    expect(total).toBeGreaterThan(0);
    expect(excluded).toBeGreaterThan(0);
    expect(excluded).toBeLessThan(total);
    const w = record('a', [], {
      pains: [
        {
          itemId: MAIN.id,
          exerciseId: MAIN.exerciseId,
          area: 'shoulder',
          type: 'dull',
          action: 'swapped',
        } as WorkoutRecord['pains'][number],
      ],
    });
    expect(painSwaps([w], 'shoulder')).toBe(1);
    expect(painSwaps([w], 'knee')).toBe(0);
  });
});

describe('family dashboard summary', () => {
  it("reads this week's activity from a member's snapshot, nothing else", () => {
    const w = record('a', [log('2026-09-27T10:30:00.000Z')], {
      startedAt: '2026-09-27T10:00:00.000Z',
      endedAt: '2026-09-27T10:30:00.000Z',
    });
    const old = record('b', [log('2026-09-10T10:00:00.000Z')]);
    const store: Record<string, string> = {
      'profile-snapshot:p2': JSON.stringify({ workouts: [w, old], streak: null }),
    };
    const read = (k: string) => store[k] ?? null;
    const profile = { id: 'p2', name: 'Alex', createdAt: '2026-09-01T00:00:00.000Z' };
    const s = activitySummary(profile as never, read, NOW, 0)!;
    expect(s).toEqual({
      workoutsThisWeek: 1,
      minutesThisWeek: 30,
      lastWorkoutAt: '2026-09-27T10:30:00.000Z',
      streak: 0,
    });
    expect(activitySummary({ ...profile, id: 'none' } as never, read, NOW, 0)).toBeNull();
  });
});
