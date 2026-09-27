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

async function setUp(minutes: number, exercisesPerSession: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
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
    expect(screen.getByText(/min left in your time/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise?' }));
    expect(mainCount()).toBe(4);
  });

  it('no offer when the session already fills its time', async () => {
    await setUp(20, 5);
    await render(<WorkoutScreen />);
    expect(screen.queryByRole('button', { name: 'Add 1 exercise?' })).toBeNull();
  });
});
