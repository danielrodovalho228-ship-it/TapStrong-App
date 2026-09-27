import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import BodyMapScreen from '@/app/(tabs)/body';
import GoalsSheet from '@/app/goals';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
const mockRouter = jest.requireMock('expo-router').router as Record<
  'push' | 'back' | 'replace',
  jest.Mock
>;

const events: string[] = [];
setAnalyticsSink((event) => events.push(event));
const store = () => useOnboardingStore.getState();

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

beforeEach(async () => {
  await act(() => store().reset());
  await act(() =>
    store().update({ birthMonth: 3, birthYear: 1983, sex: 'm', mainGoals: ['look'] }),
  );
  [mockRouter.push, mockRouter.back, mockRouter.replace].forEach((fn) => fn.mockReset());
  useWorkoutStore.getState().reset();
  mockParams = {};
  events.length = 0;
});

async function renderMap() {
  await render(<BodyMapScreen />);
  await fireEvent(screen.getByTestId('bodymap-canvas'), 'layout', {
    nativeEvent: { layout: { width: 342, height: 600, x: 0, y: 0 } },
  });
}

describe('Body map (mockup 08)', () => {
  it('tapping a dot selects the muscle with the default goal', async () => {
    await renderMap();
    await fireEvent.press(screen.getByRole('button', { name: 'Upper chest' }));
    expect(store().muscleGoals).toEqual([{ muscleKey: 'upperChest', goal: 'grow' }]);
    expect(screen.getByText('1 area selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upper chest, Grow. Change goal' })).toBeTruthy();
    expect(events).toContain('bodymap_muscle_tapped');
  });

  it('zooms with + and − for people who cannot pinch, and dots still work', async () => {
    await renderMap();
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    expect(zoomOut).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Upper chest' }));
    expect(store().muscleGoals).toEqual([{ muscleKey: 'upperChest', goal: 'grow' }]);
  });

  it('removes an area from its chip', async () => {
    await act(() => store().update({ muscleGoals: [{ muscleKey: 'quads', goal: 'grow' }] }));
    await renderMap();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Quads' }));
    expect(store().muscleGoals).toEqual([]);
    expect(screen.getByRole('button', { name: 'Set goals' })).toBeDisabled();
  });

  it('switches to the back view and its muscles', async () => {
    await renderMap();
    expect(screen.queryByRole('button', { name: 'Hamstrings' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Back view' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hamstrings' }));
    expect(store().muscleGoals.map((m) => m.muscleKey)).toEqual(['hamstrings']);
  });

  it('spreads an interview goal on "chest" over the three chest dots', async () => {
    await act(() => store().update({ muscleGoals: [{ muscleKey: 'chest', goal: 'firm' }] }));
    await renderMap();
    expect(store().muscleGoals.map((m) => m.muscleKey)).toEqual([
      'upperChest',
      'midChest',
      'lowerChest',
    ]);
    expect(screen.getByText('3 areas selected')).toBeTruthy();
  });

  it('adult profiles are not offered kid or teen bodies', async () => {
    await renderMap();
    await fireEvent.press(screen.getByRole('button', { name: /Age model/ }));
    expect(screen.queryByRole('button', { name: 'Age 9–12' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Age 13–17' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Age 45–59' })).toBeTruthy();
  });

  it('switches body model without changing the profile', async () => {
    await renderMap();
    await fireEvent.press(screen.getByRole('button', { name: 'Female' }));
    expect(store().bodyModel.sex).toBe('f');
    expect(store().sex).toBe('m');
  });

  it('"Set goals" opens the sheet for the first area', async () => {
    await act(() => store().update({ muscleGoals: [{ muscleKey: 'glutes', goal: 'grow' }] }));
    await renderMap();
    await fireEvent.press(screen.getByRole('button', { name: 'Set goals' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/goals',
      params: { muscle: 'glutes' },
    });
  });
});

describe('Goals sheet (mockup 09)', () => {
  beforeEach(async () => {
    await act(() =>
      store().update({
        muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
        daysPerWeek: 3,
      }),
    );
    mockParams = { muscle: 'upperChest' };
  });

  it('shows the muscle, its anatomy and changes the goal', async () => {
    await render(<GoalsSheet />);
    expect(screen.getByText('Pectoralis major · clavicular head')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Grow, More size and fullness' })).toBeChecked();
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Firm & tone, Tighter look + fat-loss finisher' }),
    );
    expect(store().muscleGoals[0].goal).toBe('firm');
  });

  it('teens never see "fat-loss"', async () => {
    await act(() => store().update({ birthYear: 2011 }));
    await render(<GoalsSheet />);
    expect(screen.queryByText(/fat-loss/)).toBeNull();
    expect(screen.getByText('Tighter look + short cardio finisher')).toBeTruthy();
  });

  it('says the quantities are for the whole workout', async () => {
    await render(<GoalsSheet />);
    expect(screen.getByText('For the whole workout')).toBeTruthy();
  });

  it('steppers change quantities within range', async () => {
    await act(() => store().update({ setsPerExercise: 6 }));
    await render(<GoalsSheet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Exercises' }));
    expect(store().exercisesPerSession).toBe(6);
    expect(screen.getByRole('button', { name: 'Increase Sets each' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Days a week' }));
    expect(store().daysPerWeek).toBe(2);
  });

  it('"Generate my workout" builds the workout and opens it', async () => {
    await act(() => store().update({ minutes: 40 }));
    await act(() => store().setLocation('gym'));
    await render(<GoalsSheet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Generate my workout' }));
    const [workout] = useWorkoutStore.getState().workouts;
    expect(workout.status).toBe('planned');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]',
      params: { id: workout.id },
    });
    expect(events).toContain('workout_generated');
  });

  it('without a place or time, it opens the "not available" state', async () => {
    await render(<GoalsSheet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Generate my workout' }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]',
      params: { id: 'unavailable' },
    });
  });
});
