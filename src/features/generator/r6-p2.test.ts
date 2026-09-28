/**
 * QA round 6 — P2 (generator and logic): pull keeps up with push over five
 * weeks with real vertical pulls, no holds as gym main work, load steps,
 * harder bodyweight versions, the pain-today reason, and Single workouts
 * over several chest regions.
 */
import { devLibrary } from '../exercises/library';
import { libraryView } from '../library/browse';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { planById, planDayInput } from '../program/plans';
import { loadAdvice, type Session } from '../workout/loads';

import { generateSession } from './generate';
import type { GeneratorInput, RecentSession } from './types';

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const groupOf = (k: string) => muscleByKey(muscleByKey(k)?.parentKey ?? k)?.movementGroup;
const ken: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 60,
  mainGoals: ['strength'],
  muscleGoals: ['upperChest', 'shoulders', 'triceps', 'midChest'].map((muscleKey) => ({
    muscleKey,
    goal: 'grow' as const,
  })),
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

/** Five weeks, a session every `step` days; per calendar week of 7 days. */
function weeks(input: GeneratorInput, step: number) {
  const recent: RecentSession[] = [];
  const out: { push: number; pull: number; vertical: string[]; holds: string[] }[] = [];
  for (let d = 0; d < 35; d += step) {
    const w = Math.floor(d / 7);
    out[w] ??= { push: 0, pull: 0, vertical: [], holds: [] };
    const day = new Date(Date.parse('2026-09-07T12:00:00Z') + d * 864e5).toISOString().slice(0, 10);
    const s = generateSession({
      ...input,
      today: day,
      now: `${day}T12:00:00Z`,
      recentSessions: [...recent],
    });
    for (const i of main(s)) {
      const e = byId.get(i.exerciseId)!;
      const g = groupOf(e.muscles.find((m) => m.role === 'primary')!.muscleKey);
      if (g === 'push') out[w].push += i.sets;
      if (g === 'pull') out[w].pull += i.sets;
      if (e.pattern === 'vertical_pull') out[w].vertical.push(e.slug);
      if (e.dose === 'time') out[w].holds.push(e.slug);
    }
    recent.unshift({
      date: day,
      at: `${day}T12:00:00Z`,
      mainMuscles: main(s).flatMap((i) =>
        byId
          .get(i.exerciseId)!
          .muscles.filter((m) => m.role === 'primary')
          .map((m) => m.muscleKey),
      ),
      exerciseIds: main(s).map((i) => i.exerciseId),
    });
  }
  return out;
}

describe('pull keeps up with push (Ken, 5 weeks)', () => {
  it.each([
    ['3 push goals, 4 slots, every 3 days', ken, 3],
    [
      '2 push goals, 5 slots, every 2 days',
      {
        ...ken,
        mainGoals: ['look' as const],
        muscleGoals: [
          { muscleKey: 'midChest', goal: 'grow' as const },
          { muscleKey: 'shoulders', goal: 'grow' as const },
        ],
        exercisesPerSession: 5,
      },
      2,
    ],
  ])('%s: every week pull ≥ 90% of push, a real vertical pull, no holds', (_n, input, step) => {
    for (const w of weeks(input, step)) {
      expect(w.pull).toBeGreaterThanOrEqual(0.9 * w.push);
      expect(w.vertical.length).toBeGreaterThanOrEqual(1);
      for (const slug of w.vertical) {
        const e = LIBRARY.find((x) => x.slug === slug)!;
        expect(e.muscles.find((m) => m.role === 'primary')!.muscleKey).toBe('lats');
      }
      expect(w.holds).toEqual([]);
    }
  });

  it('every slot a push goal: pull is swapped in, a push goal keeps a move', () => {
    const input = {
      ...ken,
      muscleGoals: ['midChest', 'shoulders', 'triceps'].map((muscleKey) => ({
        muscleKey,
        goal: 'grow' as const,
      })),
      exercisesPerSession: 3,
    };
    const all = weeks(input, 2);
    const push = all.reduce((n, w) => n + w.push, 0);
    const pull = all.reduce((n, w) => n + w.pull, 0);
    expect(pull).toBeGreaterThanOrEqual(0.9 * push);
    const one = generateSession({ ...input, today: '2026-09-07' });
    expect(main(one).some((i) => groupOf(i.targetMuscle!) === 'push')).toBe(true);
  });

  it('PPL Pull day for gym "Build muscle": no dead hang or other hold as main work', () => {
    const plan = planById('muscle-ppl-3')!;
    const pullDay = plan.days.findIndex((d) => d.groups.includes('pull'));
    for (let k = 0; k < 6; k++) {
      const day = `2026-09-${String(7 + k).padStart(2, '0')}`;
      const s = generateSession({
        ...planDayInput({ ...ken, mainGoals: ['look'] }, plan, pullDay, LIBRARY),
        today: day,
      });
      for (const i of main(s)) expect(byId.get(i.exerciseId)!.dose).not.toBe('time');
    }
  });
});

describe('load progression', () => {
  const press = LIBRARY.find((e) => e.loaded && e.pattern === 'horizontal_push')!;
  const squat = LIBRARY.find((e) => e.loaded && e.pattern === 'squat')!;
  const s = (load: number, reps = 12): Session => ({
    endedAt: '',
    logs: [1, 2, 3].map(() => ({ reps, load, unit: 'lb', rpe: 7 }) as Session['logs'][number]),
  });

  it('one step, then two sessions at the new load before the next', () => {
    const base = {
      range: [8, 12] as [number, number],
      exercise: press,
      unit: 'lb' as const,
      mode: 'adult' as const,
    };
    expect(loadAdvice({ ...base, sessions: [s(95), s(95)] })).toMatchObject({
      load: 100,
      change: 'up',
    });
    // 100 once, 95 before: not yet (it went 95 → 100 → 105 before).
    expect(loadAdvice({ ...base, sessions: [s(100), s(95)] })).toMatchObject({
      load: 100,
      change: 'same',
    });
    expect(loadAdvice({ ...base, sessions: [s(100), s(100)] })).toMatchObject({
      load: 105,
      change: 'up',
    });
  });

  it('60+ and heart / blood pressure: the smaller of +5 lb and ~10%', () => {
    const base = { range: [10, 12] as [number, number], exercise: squat, unit: 'lb' as const };
    // 60+: +1 rep first, then the gentle step (25 → 27.5, never 35).
    const beat = (load: number) => s(load, 13);
    expect(loadAdvice({ ...base, mode: 'senior', sessions: [beat(25), beat(25)] })).toMatchObject({
      load: 27.5,
      change: 'up',
    });
    expect(
      loadAdvice({ ...base, mode: 'adult', cardio: true, sessions: [s(100, 12), s(100, 12)] }),
    ).toMatchObject({ load: 105, change: 'up' });
    // Without the condition an adult squat keeps the +10 lb step.
    expect(
      loadAdvice({ ...base, mode: 'adult', sessions: [s(100, 12), s(100, 12)] }),
    ).toMatchObject({
      load: 110,
    });
  });

  it('bodyweight at the top of the range for 4 sessions: a harder version', () => {
    const pushUp = LIBRARY.find((e) => !e.loaded && e.pattern === 'horizontal_push')!;
    const bw = (): Session => ({
      endedAt: '',
      logs: [1, 2, 3].map(() => ({ reps: 15, rpe: 7 }) as never),
    });
    const base = {
      range: [8, 12] as [number, number],
      exercise: pushUp,
      unit: 'lb' as const,
      mode: 'adult' as const,
    };
    expect(loadAdvice({ ...base, sessions: [bw(), bw(), bw()] })).not.toMatchObject({
      harder: true,
    });
    expect(loadAdvice({ ...base, sessions: [bw(), bw(), bw(), bw()] })).toMatchObject({
      kind: 'reps',
      reps: 12,
      harder: true,
    });
  });
});

describe('Library reason after a sharp stop', () => {
  it('knee-tagged moves say "left out today" when the stop is not a restriction', () => {
    const view = libraryView(
      { ...ken, restrictions: [], stoppedToday: ['knee'] },
      { muscle: 'quads' },
      (e) => e.slug,
    );
    expect(view.notForYou.length).toBeGreaterThan(0);
    expect(view.notForYou.every((x) => x.reason !== 'restriction')).toBe(true);
    expect(view.notForYou.some((x) => x.reason === 'painToday')).toBe(true);
  });
});

describe('Single workout over several chest regions', () => {
  it('covers upper, mid and lower chest and fills to the count', () => {
    const s = generateSession({
      ...ken,
      mainGoals: ['look'],
      targetsOnly: true,
      muscleGoals: ['upperChest', 'midChest', 'lowerChest'].map((muscleKey) => ({
        muscleKey,
        goal: 'grow' as const,
      })),
      exercisesPerSession: 5,
      today: '2026-09-28',
    });
    const targets = main(s).map((i) => i.targetMuscle);
    expect(targets).toHaveLength(5);
    expect(new Set(targets)).toEqual(new Set(['upperChest', 'midChest', 'lowerChest']));
    expect(s.estimatedMinutes).toBeGreaterThan(30);
  });
});
