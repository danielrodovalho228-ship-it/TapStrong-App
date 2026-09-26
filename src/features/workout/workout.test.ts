import seed from '../../../supabase/seed/exercises.json';
import { clock } from '@/lib/clock';

import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { generateSession, type GeneratedSession, type GeneratorInput } from '../generator';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { allSteps, canEndTimedStep, currentStep, mainSetCounts, stepAfter } from './flow';
import { finisherInput, isReviewed, recentSessions, withFocus } from './plan';
import { pastSessions, progressionFor, suggestedLoad } from './progression';
import {
  bodyStates,
  groupMuscles,
  muscleActivity,
  neglectedGroup,
  stateForHours,
} from './recovery';
import { useWorkoutStore } from './store';
import { initialStreak, recordActiveDay, streakToday, type StreakState } from './streak';
import type { SetLog, WorkoutRecord } from './types';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);

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

const session = (patch: Partial<GeneratorInput> = {}) => generateSession({ ...base, ...patch });

function record(s: GeneratedSession, patch: Partial<WorkoutRecord> = {}): WorkoutRecord {
  return {
    id: 'w1',
    kind: 'regular',
    createdAt: '2026-09-20T10:00:00.000Z',
    status: 'active',
    session: s,
    logs: [],
    skipped: [],
    swaps: [],
    pains: [],
    ...patch,
  };
}

/** Logs every step of the items matching `filter`. */
function logAll(w: WorkoutRecord, at: string, filter = (_: string) => true): SetLog[] {
  return allSteps(w.session.items)
    .filter((s) => filter(s.item.role))
    .map((s) => ({
      itemId: s.item.id,
      exerciseId: s.item.exerciseId,
      setNo: s.setNo,
      reps: s.item.reps?.[1],
      loggedAt: at,
    }));
}

describe('streak', () => {
  const run = (days: string[], start: StreakState = initialStreak()) =>
    days.reduce((s, d) => recordActiveDay(s, d).state, start);

  it('counts consecutive active days and ignores a second log the same day', () => {
    const s = run(['2026-09-21', '2026-09-22', '2026-09-22', '2026-09-23']);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('allows one rest day per calendar week', () => {
    // Mon, (Tue rest), Wed, Thu
    const s = run(['2026-09-21', '2026-09-23', '2026-09-24']);
    expect(s.current).toBe(3);
  });

  it('breaks on a second missed day in the same week without a freeze', () => {
    // Mon, (Tue rest), Wed, (Thu missed) Fri
    const s = run(['2026-09-21', '2026-09-23', '2026-09-25']);
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });

  it('gives each calendar week its own rest day (weeks start on Monday)', () => {
    // Sat, (Sun rest, week 1), (Mon rest, week 2), Tue
    const s = run(['2026-09-26', '2026-09-29']);
    expect(s.current).toBe(2);
  });

  it('earns a freeze every 7 active days, at most 2', () => {
    const days = Array.from({ length: 21 }, (_, i) => {
      const d = new Date(2026, 8, 1 + i, 12);
      return `2026-09-${String(d.getDate()).padStart(2, '0')}`;
    });
    let s = initialStreak();
    const milestones: number[] = [];
    for (const d of days) {
      const r = recordActiveDay(s, d);
      if (r.milestone) milestones.push(r.state.current);
      s = r.state;
    }
    expect(milestones).toEqual([7, 14, 21]);
    expect(s.freezes).toBe(2);
  });

  it('spends a freeze when the weekly rest day is used up', () => {
    const start: StreakState = { ...initialStreak(), current: 7, best: 7, freezes: 1 };
    // Mon, (Tue rest), Wed, (Thu freeze), Fri
    const s = run(['2026-09-21', '2026-09-23', '2026-09-25'], {
      ...start,
      lastActive: '2026-09-20',
    });
    expect(s.current).toBe(10);
    expect(s.freezes).toBe(0);
  });

  it('shows 0 today when the gap can no longer be covered', () => {
    const s = run(['2026-09-21', '2026-09-22']);
    expect(streakToday(s, '2026-09-23')).toBe(2);
    expect(streakToday(s, '2026-09-24')).toBe(2); // Wed is the rest day
    expect(streakToday(s, '2026-09-25')).toBe(0);
  });
});

describe('recovery colors', () => {
  it('follows the SPEC §4 bands, with 96 h for 60+', () => {
    expect(stateForHours(2, 'adult')).toBe('fresh');
    expect(stateForHours(30, 'adult')).toBe('recovering');
    expect(stateForHours(60, 'adult')).toBe('almost');
    expect(stateForHours(80, 'adult')).toBe('neutral');
    expect(stateForHours(80, 'senior')).toBe('almost');
    expect(stateForHours(100, 'senior')).toBe('neutral');
    expect(stateForHours(121, 'adult')).toBe('neglected');
  });

  // One exercise: no balance-pass extras, so legs and back stay untrained.
  const s = session({ exercisesPerSession: 1 });
  const done = record(s, { status: 'done', endedAt: '2026-09-20T11:00:00.000Z' });
  done.logs = logAll(done, '2026-09-20T10:30:00.000Z');
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('turns only main-work muscles red; secondary ones show as also worked', () => {
    const activity = muscleActivity([done], LIBRARY, now);
    const states = bodyStates(activity, now, 'adult', []);
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    const mainPrimary = new Set(
      s.items
        .filter((i) => i.role === 'main')
        .flatMap((i) => byId.get(i.exerciseId)!.muscles)
        .filter((m) => m.role === 'primary')
        .map((m) => m.muscleKey),
    );
    expect(mainPrimary.size).toBeGreaterThan(0);
    for (const key of mainPrimary) expect(states[key]).toBe('fresh');
    const others = Object.entries(states).filter(([k]) => !mainPrimary.has(k));
    expect(others.every(([, v]) => v !== 'fresh')).toBe(true);
    expect(others.some(([, v]) => v === 'recovering')).toBe(true);
  });

  it('ignores warm-up and cool-down logs', () => {
    const warmOnly = record(s, { status: 'partial', endedAt: '2026-09-20T11:00:00.000Z' });
    warmOnly.logs = logAll(warmOnly, '2026-09-20T10:30:00.000Z', (r) => r !== 'main');
    const states = bodyStates(muscleActivity([warmOnly], LIBRARY, now), now, 'adult', []);
    expect(Object.values(states).every((v) => v === 'neutral')).toBe(true);
  });

  it('greys tracked muscles only after a first workout', () => {
    const fresh = bodyStates({}, now, 'adult', ['quads']);
    expect(fresh.quads).toBe('neutral');
    const after = bodyStates(muscleActivity([done], LIBRARY, now), now, 'adult', ['quads']);
    expect(after.quads).toBe('neglected');
    expect(after.calves).toBe('neutral');
  });

  it('greys a muscle 5 days after training it', () => {
    const later = new Date('2026-09-26T12:00:00.000Z');
    const states = bodyStates(muscleActivity([done], LIBRARY, later), later, 'adult', []);
    expect(Object.values(states)).toContain('neglected');
    expect(Object.values(states)).not.toContain('fresh');
  });

  it('suggests the push/pull/legs group left untrained longest', () => {
    const activity = muscleActivity([done], LIBRARY, now);
    const group = neglectedGroup(activity, LIBRARY, now);
    expect(group).not.toBeNull();
    expect(group).not.toBe('push'); // chest was trained today
    expect(groupMuscles('legs', LIBRARY)).toEqual(expect.arrayContaining(['quads', 'glutes']));
  });
});

describe('player flow', () => {
  const s = session();
  it('walks warm-up → main → cool-down and skips skipped items', () => {
    const w = record(s);
    const first = currentStep(w)!;
    expect(first.item.role).toBe('warmup');
    const cool = s.items.filter((i) => i.role === 'cooldown').map((i) => i.id);
    const w2 = record(s, { logs: logAll(w, 'x', (r) => r !== 'cooldown'), skipped: cool });
    expect(currentStep(w2)).toBeNull();
    const w3 = record(s, { logs: logAll(w, 'x', (r) => r === 'warmup') });
    expect(currentStep(w3)!.item.role).toBe('main');
    expect(stepAfter(w3, currentStep(w3)!)!.setNo).toBe(2);
  });

  it('counts main sets for the exit screen', () => {
    const w = record(s);
    const counts = mainSetCounts(w);
    expect(counts.done).toBe(0);
    expect(counts.total).toBe(
      s.items.filter((i) => i.role === 'main').reduce((n, i) => n + i.sets, 0),
    );
  });

  it('lets a loaded day shorten, not skip, the warm-up', () => {
    const warm = s.items.find((i) => i.part === 'warmup_general')!;
    const half = (warm.durationSeconds ?? 0) / 2;
    expect(canEndTimedStep(warm, half - 1, true)).toBe(false);
    expect(canEndTimedStep(warm, half, true)).toBe(true);
    expect(canEndTimedStep(warm, 0, false)).toBe(true);
  });
});

describe('progression', () => {
  const mk = (endedAt: string, reps: number[], load = 25): WorkoutRecord => {
    const s = session();
    const item = s.items.find((i) => i.role === 'main')!;
    return record(s, {
      id: endedAt,
      status: 'done',
      endedAt,
      logs: reps.map((r, n) => ({
        itemId: item.id,
        exerciseId: item.exerciseId,
        setNo: n + 1,
        reps: r,
        load,
        unit: 'lb',
        loggedAt: endedAt,
      })),
    });
  };
  const item = session().items.find((i) => i.role === 'main')!;

  it('suggests more load after two sessions at the top of the range', () => {
    const top = item.reps![1];
    const past = pastSessions(
      [mk('2026-09-18', [top, top]), mk('2026-09-20', [top, top])],
      item.exerciseId,
    );
    expect(progressionFor(past, item.reps)).toBe('increase');
    expect(suggestedLoad(past, 'increase', 'lb')).toBe(30);
    expect(suggestedLoad(past, 'increase', 'kg')).toBe(15); // 25 lb ≈ 11.3 kg → 12.5 + 2.5
  });

  it('holds after two sessions below the range, and needs two sessions', () => {
    const low = item.reps![0] - 1;
    const one = pastSessions([mk('2026-09-20', [low])], item.exerciseId);
    expect(progressionFor(one, item.reps)).toBeNull();
    const two = pastSessions([mk('2026-09-18', [low]), mk('2026-09-20', [low])], item.exerciseId);
    expect(progressionFor(two, item.reps)).toBe('hold');
    expect(suggestedLoad(two, 'hold', 'lb')).toBe(25);
  });
});

describe('plan helpers', () => {
  it('feeds finished workouts to the balance pass', () => {
    const s = session();
    const w = record(s, { status: 'done', endedAt: '2026-09-20T11:00:00.000Z' });
    w.logs = logAll(w, '2026-09-20T10:30:00.000Z');
    const recent = recentSessions([w, record(s, { id: 'p', status: 'planned' })], LIBRARY);
    expect(recent).toHaveLength(1);
    expect(recent[0].date).toBe('2026-09-20');
    expect(recent[0].mainMuscles).toContain('upperChest');
  });

  it('puts a focus group first once, and builds a 10-minute finisher with warm-up and cool-down', () => {
    const focused = withFocus(base, 'legs', LIBRARY);
    expect(focused.muscleGoals.length).toBeGreaterThan(base.muscleGoals.length);
    expect(groupMuscles('legs', LIBRARY)).toContain(focused.muscleGoals[0].muscleKey);

    const fin = generateSession(finisherInput(base, 'legs', LIBRARY));
    expect(fin.error).toBeUndefined();
    expect(fin.items[0].role).toBe('warmup');
    expect(fin.items[fin.items.length - 1].role).toBe('cooldown');
    expect(fin.estimatedMinutes).toBeLessThanOrEqual(10);
  });

  it('shows the coach badge only when every exercise is released', () => {
    const s = session();
    expect(isReviewed(s, LIBRARY)).toBe(false);
    const released = LIBRARY.map((e) => ({ ...e, status: 'released' as const }));
    expect(isReviewed(s, released)).toBe(true);
  });
});

describe('workout store', () => {
  const at = (iso: string) => (clock.now = () => new Date(iso));
  const realNow = clock.now;
  afterEach(() => {
    clock.now = realNow;
    useWorkoutStore.getState().reset();
  });

  it('logs sets, finishes and counts the streak', () => {
    at('2026-09-21T10:00:00');
    const st = useWorkoutStore.getState();
    const id = st.create(session());
    const w = useWorkoutStore.getState().workouts[0];
    const step = currentStep(w)!;
    st.logSet(id, {
      itemId: step.item.id,
      exerciseId: step.item.exerciseId,
      setNo: 1,
      seconds: 60,
    });
    expect(useWorkoutStore.getState().workouts[0].status).toBe('active');
    st.finish(id, 'partial');
    const after = useWorkoutStore.getState();
    expect(after.workouts[0].status).toBe('partial');
    expect(after.streak.current).toBe(1);
  });

  it('does not count a workout with nothing logged', () => {
    at('2026-09-21T10:00:00');
    const id = useWorkoutStore.getState().create(session());
    useWorkoutStore.getState().finish(id, 'partial');
    expect(useWorkoutStore.getState().streak.current).toBe(0);
  });

  it('undoes a swap within 5 seconds only', () => {
    at('2026-09-21T10:00:00.000Z');
    const st = useWorkoutStore.getState();
    const original = session();
    const id = st.create(original);
    const changed = { ...original, items: original.items.slice(0, -1) };
    const rec = {
      itemId: 'i0',
      fromExerciseId: 'a',
      toExerciseId: 'b',
      reason: 'user_choice' as const,
      setsDoneBefore: 0,
    };
    st.applySwap(id, changed, rec);
    expect(useWorkoutStore.getState().workouts[0].swaps).toHaveLength(1);
    at('2026-09-21T10:00:04.000Z');
    expect(useWorkoutStore.getState().undoSwap()).toBe(true);
    expect(useWorkoutStore.getState().workouts[0].session).toEqual(original);
    expect(useWorkoutStore.getState().workouts[0].swaps).toHaveLength(0);

    st.applySwap(id, changed, rec);
    at('2026-09-21T10:00:10.000Z');
    expect(useWorkoutStore.getState().undoSwap()).toBe(false);
    expect(useWorkoutStore.getState().workouts[0].session).toEqual(changed);
  });

  it('replaces an unstarted plan instead of piling up', () => {
    const st = useWorkoutStore.getState();
    st.create(session());
    st.create(session());
    expect(useWorkoutStore.getState().workouts).toHaveLength(1);
  });
});
