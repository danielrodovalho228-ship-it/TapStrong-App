/**
 * Phase 31, package G (reference parity): the set logger as filled cards —
 * records under a logged set ("Highest load ever lifted!"), one question
 * "How many more reps could you do?" per exercise, the muscle chip in its
 * group's colour, the 🏆 counter for adults, rest as a circle only and the
 * next-exercise preview with "Start exercise" at the bottom.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import PlayerScreen from '@/app/workout/[id]/play';
import RestScreen from '@/app/workout/[id]/rest';
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
const router = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const LIBRARY = devLibrary();
const lifts = LIBRARY.filter(
  (e) => e.loaded && e.parts.includes('main') && e.dose === 'reps' && !e.unilateral,
);
const [first, second] = lifts;
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
      muscleGoals: [{ muscleKey: first.muscles[0].muscleKey, goal: 'grow' }],
      onboardingComplete: true,
      units: 'metric',
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
  });
}

const main = (id: string, exerciseId: string, muscle: string) => ({
  id,
  role: 'main' as const,
  part: 'main' as const,
  exerciseId,
  targetMuscle: muscle,
  goal: 'grow' as const,
  sets: 3,
  reps: [8, 12] as [number, number],
  restSeconds: 60,
  perSide: false,
  loadHint: null,
  estSeconds: 200,
});

function record(id: string, opts: { done?: boolean; date?: string; load?: number } = {}) {
  const date = opts.date ?? '2026-10-01';
  const w: WorkoutRecord = {
    id,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: opts.done ? `${date}T09:40:00` : undefined,
    status: opts.done ? 'done' : 'active',
    session: {
      items: [
        main('a', first.id, first.muscles[0].muscleKey),
        main('b', second.id, second.muscles[0].muscleKey),
      ],
      minutes: 30,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: opts.done
      ? [1, 2, 3].map((setNo) => ({
          itemId: 'a',
          exerciseId: first.id,
          setNo,
          reps: 10,
          load: opts.load ?? 20,
          unit: 'kg' as const,
          loggedAt: `${date}T09:1${setNo}:00`,
        }))
      : [],
    skipped: [],
    swaps: [],
    pains: [],
  };
  return w;
}

async function player(workouts: WorkoutRecord[], id: string) {
  await act(() => useWorkoutStore.setState({ workouts }));
  mockParams = { id };
  await render(<PlayerScreen />);
}
const now = () => useWorkoutStore.getState().workouts.find((w) => w.id === 'now')!;

it('a heavier set shows its record, and 🏆 counts it on top (adults)', async () => {
  await as(1990);
  await player([record('past', { done: true, date: '2026-09-28' }), record('now')], 'now');
  // Raise the load past last time's 20 kg, then log the set.
  await fireEvent.press(screen.getByTestId('current-load'));
  for (let i = 0; i < 6; i++)
    await fireEvent.press(screen.getByRole('button', { name: /^Increase Load/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
  const logged = screen.getByTestId('set-logged');
  expect(within(logged).getByText('Highest load ever lifted!')).toBeTruthy();
  expect(screen.getByTestId('counter-records')).toBeTruthy();
});

it('a teen: no load, no record, no trophy', async () => {
  await as(new Date().getFullYear() - 15);
  await player([record('past', { done: true, date: '2026-09-28' }), record('now')], 'now');
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
  expect(screen.queryByTestId('set-pr')).toBeNull();
  expect(screen.queryByTestId('counter-records')).toBeNull();
  expect(screen.queryByText(/\b(kg|lb)\b/)).toBeNull();
});

it('"How many more reps could you do?" once per exercise sets the effort of its sets', async () => {
  await as(1990);
  await player([record('now')], 'now');
  expect(screen.queryByTestId('rir-card')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
  const card = screen.getByTestId('rir-card');
  await fireEvent.press(within(card).getByRole('radio', { name: '2 more reps' }));
  expect(
    now()
      .logs.filter((l) => l.itemId === 'a')
      .map((l) => l.rpe),
  ).toEqual([8, 8]);
  expect(screen.queryByTestId('rir-card')).toBeNull();
});

it('the muscle chip takes its group colour; sets are cards with "Done" and ▶', async () => {
  await as(1990);
  await player([record('now')], 'now');
  expect(screen.getByTestId('muscle-chip')).toBeTruthy();
  expect(within(screen.getByTestId('set-current')).getByText('Done')).toBeTruthy();
  expect(screen.getAllByTestId('set-future')).toHaveLength(2);
});

it('the next exercise preview has "Start exercise" at the bottom', async () => {
  await as(1990);
  const w = record('now');
  w.logs = [1, 2, 3].map((setNo) => ({
    itemId: 'a',
    exerciseId: first.id,
    setNo,
    reps: 10,
    load: 20,
    unit: 'kg' as const,
    loggedAt: `2026-10-01T09:1${setNo}:00`,
  }));
  await player([w], 'now');
  expect(screen.getByTestId('next-preview')).toBeTruthy();
  expect(screen.getAllByTestId('preview-set')).toHaveLength(3);
  await fireEvent.press(screen.getByTestId('start-exercise'));
  expect(screen.queryByTestId('next-preview')).toBeNull();
  expect(screen.getByTestId('set-current')).toBeTruthy();
});

it('rest is a circle: tap to skip, −15 / +15 inside, a pencil for the rest time', async () => {
  await as(1990);
  await act(() => useWorkoutStore.setState({ workouts: [record('now')] }));
  mockParams = { id: 'now' };
  await render(<RestScreen />);
  expect(screen.getByText('Tap to skip')).toBeTruthy();
  expect(screen.getByText(/^Rest: \d:\d\d$/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Change the rest time' }));
  expect(router.push).toHaveBeenCalledWith('/settings/workout');
  await fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
  expect(router.back).toHaveBeenCalled();
});
