/**
 * Phase 26 — "Month closed": the trigger, the renewal rules, the focus,
 * auto-apply + undo, and the age rules. Pure logic; the screen has its own test.
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { generateSession, type GeneratorInput } from '../generator';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import type { WorkoutRecord } from '../workout/types';

import { exerciseProgress, isCompound } from './analyze';
import { autoChooseIfPending, closeMonthIfDue, withMonth } from './apply';
import { lastClosedBlock, monthDue, stillBefore } from './cycle';
import { MAX_FOCUS, suggestFocus } from './focus';
import { changeLimit, planRenewal, repeatPlan, type RenewItem } from './renew';
import { useMonthStore } from './store';
import { buildMonthSummary } from './summary';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const primary = (e: Exercise) => e.muscles.find((m) => m.role === 'primary')?.muscleKey;
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.loaded && e.parts.includes('main'))!;
const bench = LIBRARY.find(
  (e) => e.pattern === 'horizontal_push' && e.loaded && e.parts.includes('main') && !e.isolation,
)!;

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['look'],
  muscleGoals: [
    { muscleKey: 'chest', goal: 'grow' },
    { muscleKey: 'quads', goal: 'grow' },
  ],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};

/** A finished workout on `date` with main items and their logged sets. */
function workout(
  date: string,
  moves: { id: string; target?: string; load?: number; reps?: number; sets?: number }[],
  extra: Partial<WorkoutRecord> = {},
): WorkoutRecord {
  return {
    id: `w-${date}-${moves.map((m) => m.id).join('-')}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:45:00`,
    status: 'done',
    session: {
      items: moves.map((m, i) => ({
        id: `i${i}`,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: m.id,
        targetMuscle: m.target ?? primary(byId.get(m.id)!) ?? null,
        goal: 'grow' as const,
        sets: m.sets ?? 3,
        reps: [8, 12] as [number, number],
        restSeconds: 90,
        perSide: false,
        loadHint: null,
        estSeconds: 300,
      })),
      minutes: 45,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 45,
      notes: [],
    },
    logs: moves.flatMap((m, i) =>
      Array.from({ length: m.sets ?? 3 }, (_, n) => ({
        itemId: `i${i}`,
        exerciseId: m.id,
        setNo: n + 1,
        reps: m.reps ?? 10,
        ...(m.load ? { load: m.load, unit: 'kg' as const } : {}),
        loggedAt: `${date}T09:${10 + n}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
    ...extra,
  };
}

const days = (from: string, n: number, step = 7) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i * step);
    return d.toISOString().slice(0, 10);
  });

describe('when the month closes (trigger)', () => {
  const four = days('2026-08-31', 8, 3).map((d) => workout(d, [{ id: squat.id, load: 60 }]));

  it('4-week block: due the day after it ends, not before', () => {
    expect(lastClosedBlock('2026-08-31', '2026-09-27', 4)).toBeNull();
    expect(lastClosedBlock('2026-08-31', '2026-09-28', 4)).toEqual({
      blockNo: 0,
      weeks: 4,
      from: '2026-08-31',
      to: '2026-09-28',
    });
  });

  it('a 6-week plan closes after 6 weeks; no plan = every 28 days from the first workout', () => {
    expect(lastClosedBlock('2026-08-01', '2026-09-11', 6)).toBeNull();
    expect(lastClosedBlock('2026-08-01', '2026-09-12', 6)?.to).toBe('2026-09-12');
    expect(lastClosedBlock('2026-08-01', '2026-10-23', 4)?.blockNo).toBe(1);
  });

  it('4+ workouts: summary; fewer: the light "resume" card; none at all: nothing', () => {
    const args = { anchor: '2026-08-31', today: '2026-09-29', weeks: 4, reviewedFrom: null };
    expect(monthDue({ ...args, workouts: four })?.kind).toBe('summary');
    expect(monthDue({ ...args, workouts: four.slice(0, 3) })?.kind).toBe('resume');
    expect(monthDue({ ...args, workouts: [] })).toBeNull();
  });

  it('once per block', () => {
    const args = { anchor: '2026-08-31', weeks: 4, workouts: four };
    expect(monthDue({ ...args, today: '2026-09-29', reviewedFrom: '2026-08-31' })).toBeNull();
    // The next block closes 4 weeks later.
    expect(monthDue({ ...args, today: '2026-10-26', reviewedFrom: '2026-08-31' })?.block.from).toBe(
      '2026-09-28',
    );
  });

  it('a skipped summary stays on Home for 7 days', () => {
    const now = new Date('2026-09-29T08:00:00Z');
    useMonthStore.getState().reset();
    closeMonthIfDue({
      now,
      anchor: '2026-08-31',
      weeks: 4,
      workouts: four,
      library: LIBRARY,
      generator: base,
      mode: 'adult',
      goals: ['chest'],
      favourites: [],
    });
    const until = useMonthStore.getState().cardUntil;
    expect(stillBefore(until, new Date('2026-10-05T08:00:00Z'))).toBe(true);
    expect(stillBefore(until, new Date('2026-10-07T08:00:00Z'))).toBe(false);
  });
});

describe('renewal rules', () => {
  const item = (id: string, patch: Partial<RenewItem> = {}): RenewItem => ({
    exerciseId: id,
    muscle: 'chest',
    compound: false,
    progress: 'unknown',
    pain: null,
    jointCare: false,
    ...patch,
  });
  const candidates = (it: RenewItem, exclude: ReadonlySet<string>) =>
    [`${it.exerciseId}-alt1`, `${it.exerciseId}-alt2`].filter((x) => !exclude.has(x));
  const run = (items: RenewItem[], extra: Partial<Parameters<typeof planRenewal>[0]> = {}) =>
    planRenewal({
      items,
      favourites: [],
      locked: [],
      recent: [],
      mode: 'adult',
      candidates,
      ...extra,
    });

  it('keeps the main compound that still progressed; swaps half the accessories', () => {
    const r = run([
      item('bench', { compound: true, progress: 'up' }),
      item('fly1'),
      item('fly2'),
      item('squat', { muscle: 'quads', compound: true, progress: 'up' }),
    ]);
    expect(r.keep).toEqual(expect.arrayContaining(['bench', 'squat']));
    expect(r.changes.map((c) => c.from)).toEqual(['fly1']);
    expect(r.next).toContain('fly1-alt1');
  });

  it('swaps a stalled move and one that hurt; a sharp pain is banned for good', () => {
    const r = run([
      item('bench', { compound: true, progress: 'flat' }),
      item('dip', { pain: 'dull', muscle: 'triceps' }),
      item('row', { pain: 'sharp', muscle: 'upperBack', compound: true, progress: 'up' }),
      item('squat', { muscle: 'quads', compound: true, progress: 'up' }),
    ]);
    expect(r.changes.map((c) => [c.from, c.reason])).toEqual(
      expect.arrayContaining([
        ['row', 'pain'],
        ['dip', 'pain'],
      ]),
    );
    expect(r.banned).toEqual(['row']);
    expect(r.next).not.toContain('row');
    // Repeat the same never brings the sharp one back either.
    expect(repeatPlan([item('row', { pain: 'sharp' }), item('fly')]).next).toEqual(['fly']);
  });

  it('never swaps starred or locked moves (a sharp pain still goes)', () => {
    const r = run(
      [
        item('fly1', { progress: 'flat' }),
        item('fly2', { progress: 'flat' }),
        item('fly3', { pain: 'sharp' }),
      ],
      { favourites: ['fly1', 'fly3'], locked: ['fly2'] },
    );
    expect(r.keep).toEqual(['fly1', 'fly2']);
    expect(r.changes.map((c) => c.from)).toEqual(['fly3']);
  });

  it('limits: adults and teens ~50%; 60+ and joint care 2 a month', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`m${i}`, { progress: 'flat' }));
    expect(changeLimit('adult', many)).toBe(4);
    expect(run(many).changes).toHaveLength(4);
    expect(run(many, { mode: 'teen' }).changes).toHaveLength(4);
    expect(run(many, { mode: 'senior' }).changes).toHaveLength(2);
    const joint = many.map((m, i) => (i === 0 ? { ...m, jointCare: true } : m));
    expect(run(joint).changes).toHaveLength(2);
  });

  it('a replacement avoids what was done in the last 2 blocks when it can', () => {
    const r = run([item('fly'), item('press')], { recent: ['fly-alt1'] });
    expect(r.changes[0]).toMatchObject({ from: 'fly', to: 'fly-alt2' });
  });

  it('with real exercises: the progressing compound stays, the stalled one changes', () => {
    const dates = days('2026-08-31', 8, 3);
    const history = dates.map((d, i) =>
      workout(d, [
        { id: squat.id, target: 'quads', load: 60 + i * 2.5 },
        { id: bench.id, target: 'chest', load: 50 },
      ]),
    );
    expect(exerciseProgress(history, squat.id, '2026-09-28')).toBe('up');
    expect(exerciseProgress(history, bench.id, '2026-09-28')).toBe('flat');
    expect(isCompound(squat)).toBe(true);
    useMonthStore.getState().reset();
    closeMonthIfDue({
      now: new Date('2026-09-29T08:00:00Z'),
      anchor: '2026-08-31',
      weeks: 4,
      workouts: history,
      library: LIBRARY,
      generator: base,
      mode: 'adult',
      goals: ['chest', 'quads'],
      favourites: [],
    });
    const offer = useMonthStore.getState().offer!;
    expect(offer.recommended.keep).toContain(squat.id);
    const swap = offer.recommended.changes.find((c) => c.from === bench.id)!;
    expect(swap.reason).toBe('stalled');
    // The new move trains the same muscle and passes every safety filter.
    const next = byId.get(swap.to!)!;
    expect(next.muscles.some((m) => m.role === 'primary' && m.muscleKey.includes('Chest'))).toBe(
      true,
    );
  });
});

describe('the generator follows the month, inside every limit', () => {
  const alt = LIBRARY.find(
    (e) =>
      e.id !== bench.id &&
      e.parts.includes('main') &&
      e.muscles.some((m) => m.role === 'primary' && m.muscleKey === 'midChest'),
  )!;
  const mainIds = (i: GeneratorInput) =>
    generateSession(i)
      .items.filter((x) => x.role === 'main')
      .map((x) => x.exerciseId);

  it('a banned (sharp pain) move never comes back, even starred', () => {
    const i = { ...base, favourites: [bench.id], banned: [bench.id] };
    expect(mainIds(i)).not.toContain(bench.id);
  });

  it('a swapped-out move stays out unless starred; a preferred one is picked', () => {
    const first = mainIds(base);
    const out = first[0];
    expect(mainIds({ ...base, avoid: [out] })).not.toContain(out);
    expect(mainIds({ ...base, avoid: [out], favourites: [out] })).toContain(out);
    expect(mainIds({ ...base, preferred: [alt.id] })).toContain(alt.id);
  });

  it('a preferred move blocked by a restriction is still left out', () => {
    const restricted = { ...base, restrictions: ['shoulder'], preferred: [bench.id] };
    const blocked = !mainIds({ ...base, restrictions: ['shoulder'] }).includes(bench.id);
    if (blocked) expect(mainIds(restricted)).not.toContain(bench.id);
  });

  it('the focus adds a set, but never past the weekly cap', () => {
    const chestWork = (i: GeneratorInput) =>
      generateSession(i).items.filter(
        (x) => x.role === 'main' && x.part !== 'ramp_up' && !!x.targetMuscle?.includes('hest'),
      );
    const plain = chestWork(base)[0];
    const focused = chestWork({ ...base, focusMuscles: ['chest'] })[0];
    expect(focused.sets).toBe(plain.sets + 1);
    // 18 chest sets already this week (adult cap 20): at most 2 more.
    const heavy = {
      ...base,
      focusMuscles: ['chest'],
      recentSessions: [
        {
          date: '2026-09-27',
          at: '2026-09-25T10:00:00Z',
          mainMuscles: [],
          muscleSets: { chest: 18 },
        },
      ],
    } as GeneratorInput;
    const capped = chestWork(heavy);
    expect(capped.reduce((n, x) => n + x.sets, 0)).toBeLessThanOrEqual(2);
  });
});

describe('focus for next month', () => {
  it('order: own muscle under the minimum, then imbalance, then neglected; max 2', () => {
    const picks = suggestFocus({
      weekly: {
        chest: 12,
        shoulders: 6,
        upperBack: 3,
        lats: 4,
        quads: 10,
        hamstrings: 2,
        biceps: 1,
      },
      goals: ['biceps', 'chest'],
      daysSince: { glutes: 30 },
    });
    expect(picks).toEqual([
      { muscle: 'biceps', reason: 'lowGoal' },
      { muscle: 'upperBack', reason: 'pushPull' },
    ]);
    expect(picks.length).toBeLessThanOrEqual(MAX_FOCUS);
    expect(
      suggestFocus({
        weekly: { quads: 9, hamstrings: 3, chest: 6, upperBack: 6 },
        goals: [],
        daysSince: {},
      }),
    ).toEqual([
      { muscle: 'hamstrings', reason: 'quadsHams' },
      // Never trained counts as left alone.
      { muscle: 'glutes', reason: 'neglected' },
    ]);
    expect(
      suggestFocus({ weekly: { chest: 6, upperBack: 6 }, goals: [], daysSince: { glutes: 20 } })[0],
    ).toEqual({ muscle: 'glutes', reason: 'neglected' });
  });

  it("the focus is added to the person's goals, never instead of them", () => {
    const i = withMonth(base, {
      plan: { from: '2026-09-28', next: [], avoid: [], focus: ['hamstrings'] },
      banned: [],
    });
    expect(i.muscleGoals.map((g) => g.muscleKey)).toEqual(['hamstrings', 'chest', 'quads']);
  });
});

describe('auto-apply and undo', () => {
  const history = days('2026-08-31', 8, 3).map((d, i) =>
    workout(d, [
      { id: squat.id, target: 'quads', load: 60 + i },
      { id: bench.id, target: 'chest', load: 50 },
    ]),
  );
  const open = () => {
    useMonthStore.getState().reset();
    closeMonthIfDue({
      now: new Date('2026-09-29T08:00:00Z'),
      anchor: '2026-08-31',
      weeks: 4,
      workouts: history,
      library: LIBRARY,
      generator: base,
      mode: 'adult',
      goals: ['chest', 'quads'],
      favourites: [],
    });
  };

  it('starting a workout without choosing applies the recommendation and says how many changed', () => {
    open();
    expect(autoChooseIfPending(new Date('2026-09-30T08:00:00Z'))).toBe(true);
    const s = useMonthStore.getState();
    expect(s.offer).toBeNull();
    expect(s.history[0].choice).toBe('auto');
    expect(s.autoNotice?.count).toBe(s.history[0].changes.filter((c) => c.to).length);
    expect(s.plan?.next).toEqual(expect.arrayContaining([squat.id]));
    // Nothing pending any more: no second auto-apply.
    expect(autoChooseIfPending(new Date('2026-09-30T09:00:00Z'))).toBe(false);
  });

  it('undo within 7 days brings back the previous month exactly; not after', () => {
    open();
    const before = { from: '2026-08-31', next: ['a', 'b'], avoid: ['c'], focus: ['lats'] };
    useMonthStore.setState({ plan: before });
    useMonthStore.getState().choose('continue', new Date('2026-09-29T09:00:00Z'));
    expect(useMonthStore.getState().plan).not.toEqual(before);
    expect(useMonthStore.getState().undo(new Date('2026-10-05T09:00:00Z'))).toBe(true);
    expect(useMonthStore.getState().plan).toEqual(before);

    open();
    useMonthStore.getState().choose('continue', new Date('2026-09-29T09:00:00Z'));
    expect(useMonthStore.getState().undo(new Date('2026-10-07T09:00:00Z'))).toBe(false);
  });

  it('"Repeat the same" keeps every move and no focus', () => {
    open();
    const plan = useMonthStore.getState().choose('repeat', new Date('2026-09-29T09:00:00Z'))!;
    expect(plan.next.sort()).toEqual([bench.id, squat.id].sort());
    expect(plan.avoid).toEqual([]);
    expect(plan.focus).toEqual([]);
  });
});

describe('ages', () => {
  const block = { blockNo: 1, weeks: 4, from: '2026-08-31', to: '2026-09-28' };
  const history = [
    workout('2026-08-10', [{ id: squat.id, load: 50 }]),
    ...days('2026-08-31', 8, 3).map((d, i) => workout(d, [{ id: squat.id, load: 55 + i }])),
  ];
  const summary = (mode: 'teen' | 'senior' | 'adult') =>
    buildMonthSummary({ workouts: history, library: LIBRARY, block, mode, goals: [] });

  it('a teen sees days, sets and the map, never weights or records', () => {
    const s = summary('teen');
    expect(s.workouts).toBe(8);
    expect(s.sets[Object.keys(s.sets)[0]]).toBeGreaterThan(0);
    expect(s.strength).toEqual([]);
    expect(s.records).toEqual([]);
  });

  it('60+ gets the heaviest-load record; adults too, with strength', () => {
    expect(summary('senior').records[0]).toMatchObject({ exerciseId: squat.id, kind: 'heaviest' });
    expect(summary('adult').strength.length).toBeGreaterThan(0);
  });
});
