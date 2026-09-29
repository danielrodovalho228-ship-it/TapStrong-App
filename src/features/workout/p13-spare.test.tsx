/**
 * Phase 13 follow-up (Daniel): the number of exercises the person chose is
 * kept; spare time is offered as "add 1 exercise?" and the person decides.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutScreen from '@/app/workout/[id]/index';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { useWorkoutStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const current = () => useWorkoutStore.getState().workouts.find((w) => w.id === mockParams.id)!;
const mainCount = () => current().session.items.filter((i) => i.role === 'main').length;

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

async function setUp(minutes: number, exercisesPerSession: number, birthYear = 1983) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'm',
      mainGoals: ['strength'],
      minutes,
      muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
      onboardingComplete: true,
      exercisesPerSession,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useRestrictionsStore.getState().reset();
  });
  // The same input the screen builds (today and now included).
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true, {
    recentSessions: [],
    today: '2026-09-26',
    now: '2026-09-26T12:00:00.000Z',
  })!;
  const id = useWorkoutStore.getState().create(generateSession(input));
  mockParams = { id };
}

describe('spare time', () => {
  it('keeps 3 exercises in 60 minutes and offers one more; the person decides', async () => {
    await setUp(60, 3);
    expect(mainCount()).toBe(3);
    await render(<WorkoutScreen />);
    expect(screen.getByText(/of your 60 min are planned/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise?' }));
    expect(mainCount()).toBe(4);
  });

  it('no offer when the session already fills its time', async () => {
    await setUp(20, 5);
    await render(<WorkoutScreen />);
    expect(screen.queryByRole('button', { name: 'Add 1 exercise?' })).toBeNull();
  });
});

describe('long workouts (Daniel, Phase 21)', () => {
  const estimate = () => current().session.estimatedMinutes;
  const mainSets = () =>
    current()
      .session.items.filter((i) => i.role === 'main')
      .map((i) => i.sets);

  it('90 min with 5 exercises: the offer shows the real estimate, at the top of the list', async () => {
    await setUp(90, 5);
    await render(<WorkoutScreen />);
    const before = estimate();
    expect(before).toBeLessThan(0.85 * 90);
    expect(screen.getByText(`About ${before} of your 90 min are planned.`)).toBeTruthy();
    // Above the first exercise row, not after the cool-down.
    const order = screen.toJSON() ? JSON.stringify(screen.toJSON()) : '';
    expect(order.indexOf('are planned')).toBeLessThan(order.indexOf('Warm-up'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise?' }));
    expect(mainCount()).toBe(6);
    expect(estimate()).toBeGreaterThan(before);
  });

  it.each([30, 45])('%s min: no offer', async (minutes) => {
    await setUp(minutes, 5);
    await render(<WorkoutScreen />);
    expect(screen.queryByRole('button', { name: 'Add 1 exercise?' })).toBeNull();
  });

  it.each([
    ['teen', 2010],
    ['60+', 1958],
  ])('%s sees the offer too, within 3 sets a move', async (_n, year) => {
    await setUp(90, 4, year);
    for (const n of mainSets()) expect(n).toBeLessThanOrEqual(3);
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise?' }));
    for (const n of mainSets()) expect(n).toBeLessThanOrEqual(3);
  });
});
