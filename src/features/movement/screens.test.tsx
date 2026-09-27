import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PlanScreen from '@/app/movement-pain/[id]';
import PainCheckScreen from '@/app/movement-pain/check';
import MovementPainScreen from '@/app/movement-pain/index';
import PainRetestScreen from '@/app/movement-pain/retest';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { useWorkoutStore } from '@/features/workout/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { RatePainButtons } from './Entry';
import { useMovementPainStore, type MovementPain } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };
const events: { event: string; props?: object }[] = [];
setAnalyticsSink((event, props) => events.push({ event, props }));

const REPORT: MovementPain = {
  id: 'r1',
  area: 'shoulder',
  joints: ['shoulder'],
  side: 'right',
  painful: ['shoulder.abduction', 'shoulder.external_rotation'],
  painFree: ['shoulder.flexion', 'shoulder.push', 'shoulder.pull'],
  score: 4,
  duration: '2_6_weeks',
  active: true,
  createdAt: '2026-09-01T09:00:00.000Z',
  checks: [],
  retests: [],
};

beforeAll(() => {
  clock.now = () => new Date('2026-09-27T10:00:00Z');
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'f',
      daysPerWeek: 3,
      minutes: 30,
      location: 'home',
      onboardingComplete: true,
    });
    useMovementPainStore.getState().reset();
    useRestrictionsStore.getState().reset();
    useWorkoutStore.getState().reset();
  });
  mockParams = {};
  events.length = 0;
  Object.values(router).forEach((m) => m.mockClear?.());
});

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next' }));

describe('Movement that hurts — report', () => {
  it('maps which movements hurt and which do not, then builds the plan', async () => {
    await render(<MovementPainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Shoulder' }));
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'Right' }));
    await next();
    // Red-flag screening must be answered.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'None of these' }));
    await next();

    expect(screen.getByText('Reaching sideways for something on the counter')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    // Each option names its movement, so screen readers hear distinct choices.
    expect(screen.queryAllByRole('radio', { name: 'Hurts' })).toHaveLength(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'Raise arm to the side: Hurts' }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Turn .*outward.*: Hurts$/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Raise arm in front: No pain' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pain 4 out of 10' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: '2 to 6 weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Build my recovery plan' }));

    const [r] = useMovementPainStore.getState().reports;
    expect(r).toMatchObject({
      area: 'shoulder',
      side: 'right',
      joints: ['shoulder'],
      painful: ['shoulder.abduction', 'shoulder.external_rotation'],
      painFree: ['shoulder.flexion'],
      score: 4,
      duration: '2_6_weeks',
    });
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/movement-pain/[id]',
      params: { id: r.id },
    });
    // Pain data never goes to analytics.
    expect(events).toEqual([]);
  });

  it('a red flag stops: see a doctor, no plan, the area is left out of workouts', async () => {
    mockParams = { area: 'knee' };
    await render(<MovementPainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Left' }));
    await next();
    await fireEvent.press(screen.getByText('It started after a fall, a blow or an accident'));
    await next();
    expect(screen.getByText('Please see a doctor first')).toBeTruthy();
    expect(useMovementPainStore.getState().reports).toEqual([]);
    expect(useRestrictionsStore.getState().items[0]).toMatchObject({
      area: 'knee',
      side: 'left',
      active: true,
    });
  });

  it('children only with a parent or guardian', async () => {
    await act(() => useOnboardingStore.getState().update({ birthYear: 2016 }));
    await render(<MovementPainScreen />);
    expect(screen.getByText('Do this with your parent or guardian.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await fireEvent.press(screen.getByText('A parent or guardian is with me'));
    await next();
    expect(screen.getByText('Where does it hurt?')).toBeTruthy();
  });
});

describe('Recovery plan', () => {
  it('shows the phase and the movements, and starts a recovery session', async () => {
    await act(() => useMovementPainStore.getState().add(REPORT));
    mockParams = { id: 'r1' };
    await render(<PlanScreen />);
    expect(screen.getByText('Phase 1 of 3')).toBeTruthy();
    expect(screen.getByText('Hurts: Raise arm to the side, Turn arm outward')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start a 15-min recovery session' }));
    const [w] = useWorkoutStore.getState().workouts;
    expect(w.kind).toBe('repair');
    expect(w.session.items[0].role).toBe('warmup');
    expect(w.session.items.at(-1)!.role).toBe('cooldown');
    expect(events).toEqual([{ event: 'workout_generated', props: undefined }]);
  });

  it('recommends a physical therapist when the retest got worse', async () => {
    await act(() =>
      useMovementPainStore.getState().add({
        ...REPORT,
        retests: [{ at: '2026-09-08T09:00:00.000Z', scores: { 'shoulder.abduction': 6 } }],
      }),
    );
    mockParams = { id: 'r1' };
    await render(<PlanScreen />);
    expect(screen.getByText('See a physical therapist')).toBeTruthy();
  });

  it('rates the pain after a workout: over 5 is red', async () => {
    await act(() => useMovementPainStore.getState().add(REPORT));
    mockParams = { id: 'r1', kind: 'after', workout: 'w1' };
    await render(<PainCheckScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Pain 6 out of 10' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(useMovementPainStore.getState().reports[0].checks[0]).toMatchObject({
      kind: 'after',
      workoutId: 'w1',
      score: 6,
    });
    expect(screen.getByText('Saved: Red.')).toBeTruthy();
  });

  it('weekly retest rates every painful movement', async () => {
    await act(() => useMovementPainStore.getState().add(REPORT));
    mockParams = { id: 'r1' };
    await render(<PainRetestScreen />);
    const save = () => screen.getByRole('button', { name: 'Save retest' });
    expect(save()).toBeDisabled();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Pain 3 out of 10' })[0]);
    expect(save()).toBeDisabled();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Pain 2 out of 10' })[1]);
    await fireEvent.press(save());
    expect(useMovementPainStore.getState().reports[0].retests[0].scores).toEqual({
      'shoulder.abduction': 3,
      'shoulder.external_rotation': 2,
    });
  });

  it('after a workout, offers to rate each open plan once', async () => {
    await act(() => useMovementPainStore.getState().add(REPORT));
    await render(<RatePainButtons workoutId="w1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rate the pain: Right Shoulder' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/movement-pain/check',
      params: { id: 'r1', kind: 'after', workout: 'w1' },
    });
  });
});
