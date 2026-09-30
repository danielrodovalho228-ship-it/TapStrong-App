/**
 * Phase 27, C — Surprising: the Moments rules. At most one per workout and
 * about one in three workouts; never the same one twice; never during a
 * workout; minors only get habit, curiosity and map Moments; 60+ at most one
 * a week; turned off in Settings means none; the seeded draw is
 * reproducible; big milestones always show.
 */
import '@/i18n';

import { readFileSync } from 'fs';
import { join } from 'path';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DoneScreen from '@/app/workout/[id]/done';
import WorkoutSettings from '@/app/settings/workout';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import ptBR from '@/i18n/locales/pt-BR.json';

import { devLibrary } from '../exercises/library';

import {
  candidates,
  pickMoment,
  SMALL_CHANCE,
  type MomentContext,
  type MomentKind,
  type ShownMoment,
} from './engine';
import { FACTS } from './facts';
import { useMomentsStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;
const row = LIBRARY.find((e) => e.pattern === 'horizontal_pull' && e.parts.includes('main'))!;
const NOW = new Date('2026-09-30T18:00:00');
const realNow = clock.now;

function workout(
  i: number,
  date = '2026-09-30',
  extra: Partial<WorkoutRecord> = {},
): WorkoutRecord {
  const moves = i % 2 ? [row, squat] : [squat, row];
  return {
    id: `w${i}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:40:00`,
    status: 'done',
    session: {
      items: moves.map((e, n) => ({
        id: `i${n}`,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: e.id,
        targetMuscle: e.muscles.find((m) => m.role === 'primary')!.muscleKey,
        goal: 'grow' as const,
        sets: 2,
        reps: [8, 12] as [number, number],
        restSeconds: 60,
        perSide: false,
        loadHint: null,
        estSeconds: 200,
      })),
      minutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 40,
      notes: [],
    },
    logs: moves.flatMap((e, n) =>
      [1, 2].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: e.id,
        setNo,
        reps: 10,
        loggedAt: `${date}T09:1${setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
    ...extra,
  };
}

/** A history of `n` finished workouts, the last one just ended. */
function ctx(n: number, patch: Partial<MomentContext> = {}): MomentContext {
  const workouts = Array.from({ length: n }, (_, i) => workout(i));
  return {
    now: NOW,
    seed: 'person-a',
    mode: 'adult',
    enabled: true,
    where: 'done',
    workout: workouts.at(-1),
    workouts,
    library: LIBRARY,
    shown: [],
    ...patch,
  };
}

beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});

describe('the catalog', () => {
  it('has at least 12 kinds of Moments and 30 facts, in every language', () => {
    const kinds = Object.keys(en.moments.kinds);
    expect(kinds.length + 1).toBeGreaterThanOrEqual(12); // + "fact"
    expect(FACTS).toHaveLength(30);
    for (const tree of [en, es, ptBR] as unknown as {
      moments: { facts: object; kinds: object };
    }[]) {
      expect(Object.keys(tree.moments.facts)).toHaveLength(30);
      expect(Object.keys(tree.moments.kinds).sort()).toEqual(kinds.sort());
    }
  });

  it('facts are anatomy, never a health promise or a body ideal', () => {
    const banned =
      /cure|prevent|guarantee|burn fat|lose weight|perfect body|heal|cura|previne|garante|queima|emagre|corpo perfeito|quema|adelgaz|cuerpo perfecto/i;
    for (const tree of [en, es, ptBR])
      for (const text of Object.values(tree.moments.facts)) expect(text).not.toMatch(banned);
  });

  it('facts only name muscles from the muscles table', () => {
    const muscles = require('@/features/muscles/muscles.json') as { key: string }[];
    const keys = new Set(muscles.map((m) => m.key));
    for (const f of FACTS) for (const m of f.muscles) expect(m === '*' || keys.has(m)).toBe(true);
  });
});

describe('frequency', () => {
  it('big milestones always show: the 10th workout', () => {
    expect(pickMoment(ctx(10))?.kind).toBe('milestone_workouts');
    expect(pickMoment(ctx(1))?.kind).toBe('first_workout');
  });

  it('at most one per workout', () => {
    const c = ctx(10);
    const first = pickMoment(c)!;
    const shown: ShownMoment[] = [
      { id: first.id, kind: first.kind, at: NOW.toISOString(), workoutId: c.workout!.id },
    ];
    expect(pickMoment({ ...c, shown })).toBeNull();
  });

  it('small Moments in about 1 of 3 workouts', () => {
    let hits = 0;
    const runs = 300;
    for (let i = 0; i < runs; i++) {
      const c = ctx(4);
      const w = { ...c.workout!, id: `run-${i}` };
      const m = pickMoment({
        ...c,
        workout: w,
        workouts: [...c.workouts.slice(0, -1), w],
        seed: `p${i}`,
      });
      if (m) hits++;
    }
    expect(hits / runs).toBeGreaterThan(SMALL_CHANCE - 0.1);
    expect(hits / runs).toBeLessThan(SMALL_CHANCE + 0.1);
  });

  it('the draw is reproducible: same person, week and workout → same Moment', () => {
    for (let i = 0; i < 20; i++) {
      const c = ctx(5, { seed: `s${i}` });
      expect(pickMoment(c)).toEqual(pickMoment({ ...c }));
    }
  });
});

describe('never twice', () => {
  it('a Moment already shown is never picked again (milestones have their own number)', () => {
    const shown: ShownMoment[] = [];
    // Many workouts in a row, each one's Moment saved: never the same id twice.
    for (let n = 1; n <= 120; n++) {
      const c = ctx(n, { seed: 'same-person', shown: [...shown] });
      const m = pickMoment(c);
      if (!m) continue;
      expect(shown.map((s) => s.id)).not.toContain(m.id);
      shown.push({ id: m.id, kind: m.kind, at: NOW.toISOString(), workoutId: c.workout!.id });
    }
    expect(shown.map((s) => s.id)).toEqual(expect.arrayContaining(['workouts:10', 'workouts:25']));
  });
});

describe('ages', () => {
  const ADULT_ONLY: MomentKind[] = [
    'milestone_reps',
    'milestone_sets',
    'coach_pain',
    'birthday',
    'repair_even',
  ];

  it('minors never get weight, record, body, pain or birthday Moments', () => {
    const pain = workout(1, '2026-09-26', {
      pains: [
        {
          itemId: 'i0',
          exerciseId: squat.id,
          area: 'knee',
          type: 'dull',
          action: 'continued',
          reportedAt: '2026-09-26T09:20:00Z',
        },
      ],
    });
    for (const mode of ['teen', 'child'] as const)
      for (let i = 0; i < 200; i++) {
        const base = ctx(0);
        const w = workout(900 + i);
        const many = Array.from({ length: 60 }, (_, k) => workout(k));
        const m = pickMoment({
          ...base,
          mode,
          seed: `m${i}`,
          workout: w,
          workouts: [...many, pain, w],
          repairEven: [{ testKey: 'hip', side: 'left', at: '2026-09-29T00:00:00Z' }],
        });
        if (m) expect(ADULT_ONLY).not.toContain(m.kind);
      }
  });

  it('60+: at most one a week', () => {
    const c = ctx(10, { mode: 'senior' });
    const recent: ShownMoment[] = [
      { id: 'fact:f30', kind: 'fact', at: '2026-09-27T10:00:00Z', workoutId: 'old' },
    ];
    expect(pickMoment({ ...c, shown: recent })).toBeNull();
    const older: ShownMoment[] = [
      { id: 'fact:f30', kind: 'fact', at: '2026-09-20T10:00:00Z', workoutId: 'old' },
    ];
    expect(pickMoment({ ...c, shown: older })?.kind).toBe('milestone_workouts');
  });
});

describe('Settings', () => {
  it('"Surprises" off means no Moment at all', () => {
    expect(pickMoment(ctx(10, { enabled: false }))).toBeNull();
    expect(pickMoment(ctx(1, { enabled: false }))).toBeNull();
  });

  it('the switch is in Workout settings', async () => {
    usePrefsStore.getState().reset();
    await render(<WorkoutSettings />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Surprises' }));
    expect(usePrefsStore.getState().surprises).toBe(false);
  });
});

describe('where they appear', () => {
  it('never during a workout: the player, rest and pain screens never use Moments', () => {
    for (const f of ['play.tsx', 'rest.tsx', 'pain.tsx', 'index.tsx']) {
      const source = readFileSync(join(__dirname, '..', '..', 'app', 'workout', '[id]', f), 'utf8');
      expect(source).not.toMatch(/useMoment|MomentCard/);
    }
  });

  it('the end screen shows the Moment and keeps it with the workout', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 1985, sex: 'f', onboardingComplete: true });
      useMomentsStore.getState().reset();
      usePrefsStore.getState().reset();
      useWorkoutStore.getState().reset();
      useWorkoutStore.setState({ workouts: [workout(0)] });
    });
    mockParams = { id: 'w0' };
    await render(<DoneScreen />);
    expect(screen.getByTestId('moment-first_workout')).toBeTruthy();
    expect(screen.getByText('First workout done. This is where it starts.')).toBeTruthy();
    expect(useMomentsStore.getState().shown).toEqual([
      expect.objectContaining({ id: 'first_workout', workoutId: 'w0' }),
    ]);
    // Opening the screen again shows the same one, never a second.
    await render(<DoneScreen />);
    expect(useMomentsStore.getState().shown).toHaveLength(1);
  });

  it('the coach remembers a pain and keeps the answer', async () => {
    await act(() => {
      useMomentsStore.getState().reset();
      useWorkoutStore.getState().reset();
      const pain = workout(1, '2026-09-26', {
        pains: [
          {
            itemId: 'i0',
            exerciseId: squat.id,
            area: 'knee',
            type: 'dull',
            action: 'continued',
            reportedAt: '2026-09-26T09:20:00Z',
          },
        ],
      });
      useMomentsStore
        .getState()
        .record(
          { id: 'first_workout', kind: 'first_workout', params: {} },
          new Date('2026-09-20T10:00:00Z'),
          'w0',
        );
      useWorkoutStore.setState({ workouts: [workout(0, '2026-09-20'), pain, workout(2)] });
    });
    const coach = candidates({
      ...ctx(0),
      workout: workout(2),
      workouts: useWorkoutStore.getState().workouts,
    }).find((m) => m.kind === 'coach_pain')!;
    expect(coach.params.area).toBe('knee');
    await act(() => {
      useMomentsStore.getState().record(coach, NOW, 'w2');
    });
    mockParams = { id: 'w2' };
    await render(<DoneScreen />);
    expect(screen.getByText('Last week your knee complained. Did today go well?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '👍 All good' }));
    expect(useMomentsStore.getState().shown.find((s) => s.kind === 'coach_pain')?.answer).toBe(
      'good',
    );
  });
});
