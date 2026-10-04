import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { blockReason, generateSession, getAlternatives, type GeneratorInput } from '../generator';
import { rangeFor } from '../generator/filters';
import { GYM_EQUIPMENT_OPTIONS, HOME_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { safetyRefresh, workoutInput } from '../workout/safety';
import type { WorkoutRecord } from '../workout/types';
import { addDays } from '@/lib/dates';

import { afterLayout, dailyLayout, dailyPlan, sleeperLayout } from './daily';
import { aboveOrBehind } from '../movement/overhead';
import { buildProgramSession, SHOULDER_PROGRAM as P, type SessionLayout } from './programs';
import { careProtection, withCare } from './protect';
import type { ProgramRun } from './store';

/**
 * Phase 32 A1 (Daniel, Oct 4): with a frozen shoulder or shoulder pain, no
 * exercise with the shoulder above 90° or behind the back reaches the plan,
 * "Shoulder today" or the swap sheet. Which exercise does what comes from the
 * database joint tags.
 */
const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const MONDAY = '2026-10-05';

const run = (o: Partial<ProgramRun> = {}): ProgramRun => ({
  side: 'right',
  startedAt: MONDAY,
  safetyAcceptedAt: 'now',
  maintenance: false,
  increased: {},
  review: {},
  cleared: null,
  releasedAt: null,
  sleeperReminders: false,
  ...o,
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

/** Above 90° or behind the back, unless the exercise is cut to shoulder height. */
const unsafe = (e: Exercise, input: GeneratorInput) =>
  aboveOrBehind(e) && !(rangeFor(e, input) === 'reduced' && !e.joints.some(behindOrOverhead));
const behindOrOverhead = (j: Exercise['joints'][number]) =>
  j.joint === 'shoulder' && (j.movement === 'overhead' || j.movement === 'reach_behind');

describe('the shoulder program never goes above the shoulder or behind the back', () => {
  const layouts: SessionLayout[] = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(MONDAY, d);
    for (const full of [false, true]) {
      const plan = dailyPlan(P, day, {});
      layouts.push(dailyLayout(P, plan, full));
      if (plan.block !== 'stretch')
        layouts.push(afterLayout(P, plan.block, plan.numbers, { full, warm: d % 2 === 0 }));
    }
  }
  layouts.push(sleeperLayout(P));

  it('sessions A, B, C, every daily block, the after-workout part and the sleeper break', () => {
    const sessions = [
      ...(['A', 'B', 'C'] as const).map((k) => buildProgramSession(P, k, opts())),
      ...layouts.map((l) => buildProgramSession(P, l, opts())),
    ];
    for (const s of sessions)
      for (const i of s.items) {
        const e = byId.get(i.exerciseId)!;
        expect([e.slug, aboveOrBehind(e)]).toEqual([e.slug, false]);
      }
  });

  it('the triceps exercise is the kickback, arm at the side (AAOS)', () => {
    const c = buildProgramSession(P, 'C', opts());
    const slugs = c.items.map((i) => byId.get(i.exerciseId)!.slug);
    expect(slugs).toContain('dumbbell_kickback');
    expect(slugs).not.toContain('overhead_dumbbell_triceps_extension');
    expect(P.exercises.some((x) => x.slug === 'overhead_dumbbell_triceps_extension')).toBe(false);
  });

  it('the swap sheet inside a program session: never overhead; behind the back only after "Yes"', () => {
    for (const r of [run(), run({ cleared: false }), run({ cleared: true })]) {
      const behindOk = r.cleared === true;
      const input = withCare(base, careProtection({ [P.id]: r }, MONDAY));
      for (const key of ['A', 'B', 'C'] as const) {
        const session = buildProgramSession(P, key, { ...opts(), behindOk });
        const check = workoutInput({ kind: 'repair', session }, input);
        for (const item of session.items) {
          const offered = getAlternatives(session, item.id, check, { limit: 999 });
          const bad = offered.filter((e) => aboveOrBehind(e, { behindOk })).map((e) => e.slug);
          expect([key, item.id, bad]).toEqual([key, item.id, []]);
        }
      }
    }
  });
});

describe('stretch 3 (stick behind the back) comes back only with the physio\'s "Yes"', () => {
  const slugs = (behindOk: boolean) =>
    buildProgramSession(P, 'A', { ...opts(), behindOk }).items.map(
      (i) => byId.get(i.exerciseId)!.slug,
    );

  it('"No" or "Not sure": left out', () => {
    expect(slugs(false)).not.toContain('stick_internal_rotation_stretch');
  });

  it('"Yes": in session A, and its own session keeps it (no safety swap)', () => {
    expect(slugs(true)).toContain('stick_internal_rotation_stretch');
    const session = buildProgramSession(P, 'A', { ...opts(), behindOk: true });
    const input = withCare(base, careProtection({ [P.id]: run({ cleared: true }) }, MONDAY));
    const w = {
      id: 'w',
      kind: 'repair',
      status: 'planned',
      session,
      logs: [],
      skipped: [],
      swaps: [],
      pains: [],
      createdAt: MONDAY,
    } as unknown as WorkoutRecord;
    expect(safetyRefresh(w, input)).toEqual({ kind: 'ok' });
  });

  it('the regular workout keeps it out even after "Yes"', () => {
    const input = withCare(base, careProtection({ [P.id]: run({ cleared: true }) }, MONDAY));
    const stick = LIBRARY.find((e) => e.slug === 'stick_internal_rotation_stretch')!;
    expect(blockReason(stick, input)).not.toBeNull();
  });
});

describe('the regular workout and its swap sheet, while the shoulder program runs', () => {
  const inputs: [string, GeneratorInput][] = [];
  for (const location of ['gym', 'home'] as const) {
    const where = {
      ...base,
      location,
      equipment: location === 'gym' ? GYM_EQUIPMENT_OPTIONS : HOME_EQUIPMENT_OPTIONS,
    };
    inputs.push(
      [`${location} not cleared`, withCare(where, careProtection({ [P.id]: run() }, MONDAY))],
      [
        `${location} not sure`,
        withCare(
          where,
          careProtection({ [P.id]: run({ cleared: false, clearance: 'unsure' }) }, MONDAY),
        ),
      ],
      [
        `${location} cleared`,
        withCare(where, careProtection({ [P.id]: run({ cleared: true }) }, MONDAY)),
      ],
      [`${location} shoulder pain`, { ...where, painAreas: ['shoulder'], painToday: ['shoulder'] }],
    );
  }

  it.each(inputs)(
    '%s: nothing above the shoulder or behind the back, in the plan or the swaps',
    (_, input) => {
      for (const muscleKey of ['shoulders', 'chest', 'back', 'arms']) {
        const s = generateSession({ ...input, muscleGoals: [{ muscleKey, goal: 'strengthen' }] });
        for (const item of s.items) {
          const e = byId.get(item.exerciseId)!;
          expect([e.slug, unsafe(e, input)]).toEqual([e.slug, false]);
          if (item.role !== 'main') continue;
          const bad = getAlternatives(s, item.id, input, { limit: 999 })
            .filter((x) => unsafe(x, input))
            .map((x) => x.slug);
          expect([e.slug, bad]).toEqual([e.slug, []]);
        }
      }
    },
  );
});

function opts() {
  return { library: LIBRARY, affected: 'right' as const, week: 1 };
}
