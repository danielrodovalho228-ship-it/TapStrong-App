/**
 * QA round 10 — screens: cap notes render with their names (R10-01).
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import WorkoutScreen from '@/app/workout/[id]/index';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { devLibrary } from '@/features/exercises/library';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T12:00:00Z');
});

async function workoutWith(notes: unknown[]) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 60,
      muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
  });
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true, {
    today: '2026-09-28',
    now: '2026-09-28T12:00:00.000Z',
  })!;
  const s = generateSession(input);
  const id = useWorkoutStore.getState().create({ ...s, notes: notes as typeof s.notes });
  mockParams = { id };
}

it('R10-01: the weekly-cap note names the muscles, never a raw {{muscles}}', async () => {
  await workoutWith([{ key: 'generator.notes.weeklyCap', muscles: ['quads', 'glutes'] }]);
  await render(<WorkoutScreen />);
  expect(screen.getByText(/this week’s limit for Quads, Glutes/)).toBeTruthy();
  expect(screen.queryByText(/\{\{/)).toBeNull();
});

it('the joint-budget note names the joint', async () => {
  await workoutWith([{ key: 'generator.notes.jointCap', joints: ['knee'] }]);
  await render(<WorkoutScreen />);
  expect(screen.getByText(/move a painful joint \(Knee\)/)).toBeTruthy();
  expect(screen.queryByText(/\{\{/)).toBeNull();
});

it('added exercises that no longer fit are named, with the count', async () => {
  await workoutWith([{ key: 'generator.notes.addedRemoved', count: 2 }]);
  await render(<WorkoutScreen />);
  expect(screen.getByText(/2 exercises you added no longer fit/)).toBeTruthy();
});
