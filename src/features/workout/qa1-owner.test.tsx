/**
 * QA round 1 — owner requests O-1 and O-2 (docs/qa-round-1.md §0).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutScreen from '@/app/workout/[id]/index';
import { devLibrary } from '@/features/exercises/library';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { RecoveryBody } from './components/RecoveryBody';
import { useWorkoutStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

beforeAll(() => {
  clock.now = () => new Date('2026-09-27T12:00:00Z');
});

describe('O-1 recovery map uses the body-map dots, front and back', () => {
  it('fills each muscle dot with its recovery color and shows back muscles', async () => {
    await render(
      <RecoveryBody
        band="adult"
        sex="f"
        states={{ upperChest: 'fresh', glutes: 'recovering', lats: 'neglected' }}
        maxHeight={300}
      />,
    );
    const canvas = screen.getByLabelText('Your body now, Front');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 200, height: 360 } } });
    expect(screen.getAllByTestId('recovery-upperChest-fresh').length).toBeGreaterThan(0);
    // Untrained muscles are neutral dots, not missing.
    expect(screen.getAllByTestId(/recovery-\w+-neutral/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Back' }));
    const back = screen.getByLabelText('Your body now, Back');
    await fireEvent(back, 'layout', { nativeEvent: { layout: { width: 200, height: 360 } } });
    expect(screen.getAllByTestId('recovery-glutes-recovering').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('recovery-lats-neglected').length).toBeGreaterThan(0);
  });
});

describe('O-2 every item has a demo', () => {
  it('warm-up and cool-down rows get a thumbnail like the main exercises', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().update({
        birthMonth: 3,
        birthYear: 1983,
        sex: 'f',
        mainGoals: ['look'],
        minutes: 40,
        muscleGoals: [{ muscleKey: 'glutes', goal: 'grow' }],
        onboardingComplete: true,
      });
      useOnboardingStore.getState().setLocation('home');
      useWorkoutStore.getState().reset();
    });
    const input = inputFromProfile(useOnboardingStore.getState(), devLibrary(), true)!;
    const session = generateSession(input);
    mockParams = { id: useWorkoutStore.getState().create(session) };
    await render(<WorkoutScreen />);
    expect(screen.getAllByTestId('exercise-thumb', { includeHiddenElements: true })).toHaveLength(
      session.items.length,
    );
  });
});
