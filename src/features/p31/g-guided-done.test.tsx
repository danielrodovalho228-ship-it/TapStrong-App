/**
 * Phase 31, package G: the warm-up and stretch full screen (step dots, "Get
 * ready", tap to pause, one light button, "I feel pain" on top) and the end
 * screen (Close | name | Share, three numbers, the fun comparison for adults
 * with loads, never calories).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DoneScreen from '@/app/workout/[id]/done';
import PlayerScreen from '@/app/workout/[id]/play';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { useWorkoutStore } from '../workout/store';
import type { WorkoutRecord } from '../workout/types';

let mockParams: Record<string, string> = {};
jest.setTimeout(30_000);
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const lift = LIBRARY.find((e) => e.loaded && e.parts.includes('main') && e.dose === 'reps')!;
const warm = LIBRARY.find((e) => e.parts.includes('warmup_general'))!;
const NOW = new Date('2026-10-01T18:00:00');

beforeAll(() => {
  clock.now = () => NOW;
});

async function as(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 30,
      muscleGoals: [{ muscleKey: lift.muscles[0].muscleKey, goal: 'grow' }],
      onboardingComplete: true,
      units: 'metric',
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
  });
}

const timed = (id: string) => ({
  id,
  role: 'warmup' as const,
  part: 'warmup_general' as const,
  exerciseId: warm.id,
  targetMuscle: null,
  goal: null,
  sets: 1,
  durationSeconds: 60,
  restSeconds: 0,
  perSide: false,
  loadHint: null,
  estSeconds: 60,
});

function record(id: string, opts: { done?: boolean; load?: number } = {}): WorkoutRecord {
  return {
    id,
    kind: 'regular',
    createdAt: '2026-10-01T17:00:00',
    startedAt: '2026-10-01T17:00:00',
    endedAt: opts.done ? '2026-10-01T17:40:00' : undefined,
    status: opts.done ? 'done' : 'active',
    session: {
      items: [
        timed('w1'),
        timed('w2'),
        {
          id: 'a',
          role: 'main',
          part: 'main',
          exerciseId: lift.id,
          targetMuscle: lift.muscles[0].muscleKey,
          goal: 'grow',
          sets: 3,
          reps: [8, 12],
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 200,
        },
      ],
      minutes: 30,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: opts.done
      ? [
          {
            itemId: 'w1',
            exerciseId: warm.id,
            setNo: 1,
            seconds: 60,
            loggedAt: '2026-10-01T17:01:00',
          },
          {
            itemId: 'w2',
            exerciseId: warm.id,
            setNo: 1,
            seconds: 60,
            loggedAt: '2026-10-01T17:02:00',
          },
          ...[1, 2, 3].map((setNo) => ({
            itemId: 'a',
            exerciseId: lift.id,
            setNo,
            reps: 10,
            ...(opts.load ? { load: opts.load, unit: 'kg' as const } : {}),
            loggedAt: `2026-10-01T17:1${setNo}:00`,
          })),
        ]
      : [],
    skipped: [],
    swaps: [],
    pains: [],
  };
}

it('warm-up full screen: dots, "Get ready", tap to pause, one button, pain on top', async () => {
  await as(1990);
  await act(() => useWorkoutStore.setState({ workouts: [record('now')] }));
  mockParams = { id: 'now' };
  await render(<PlayerScreen />);
  expect(screen.getByTestId('guided-step')).toBeTruthy();
  expect(screen.getByTestId('guided-dots', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('Get ready')).toBeTruthy();
  expect(screen.getByText('Exercise 1/2')).toBeTruthy();
  expect(screen.getByTestId('pain-button')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  expect(screen.getByTestId('guided-done')).toBeTruthy();
});

it('end: three numbers and the fun comparison for an adult with loads', async () => {
  await as(1990);
  await act(() =>
    useWorkoutStore.setState({ workouts: [record('now', { done: true, load: 60 })] }),
  );
  mockParams = { id: 'now' };
  await render(<DoneScreen />);
  expect(screen.getByTestId('done-stats')).toBeTruthy();
  expect(screen.getByText('Exercises done')).toBeTruthy();
  expect(screen.getByTestId('done-fun')).toBeTruthy();
  expect(screen.getByText('I lifted the weight of')).toBeTruthy();
  expect(screen.queryByText(/kcal|calorie/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
});

it('end for a teen: sets, no load, no comparison', async () => {
  await as(new Date().getFullYear() - 15);
  await act(() => useWorkoutStore.setState({ workouts: [record('now', { done: true })] }));
  mockParams = { id: 'now' };
  await render(<DoneScreen />);
  expect(screen.queryByTestId('done-fun')).toBeNull();
  expect(screen.queryByText(/\b(kg|lb)\b/)).toBeNull();
  expect(screen.getByText('Sets')).toBeTruthy();
});
