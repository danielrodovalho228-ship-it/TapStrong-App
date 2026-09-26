import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ChatScreen from '@/app/onboarding/chat';
import ProfileScreen from '@/app/onboarding/profile';
import SafetyScreen from '@/app/onboarding/safety';
import WhoScreen from '@/app/onboarding/who';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { useOnboardingStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null }));

const mockRouter = jest.requireMock('expo-router').router as Record<
  'push' | 'back' | 'replace',
  jest.Mock
>;

const events: { event: string; props?: object }[] = [];
setAnalyticsSink((event, props) => events.push({ event, props }));

const store = () => useOnboardingStore.getState();

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

beforeEach(async () => {
  await act(() => store().reset());
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockParams = {};
  events.length = 0;
});

describe('Who screen (mockup 02)', () => {
  it('shows adult mode and continues to the interview', async () => {
    await act(() => store().update({ birthMonth: 3, birthYear: 1983 }));
    await render(<WhoScreen />);
    expect(screen.getByText('Adult mode · 43')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/chat');
    expect(events).toContainEqual({ event: 'age_mode_set', props: { mode: 'adult' } });
  });

  it('blocks a child under 13 from signing up alone', async () => {
    await act(() => store().update({ birthMonth: 5, birthYear: 2015 }));
    await render(<WhoScreen />);
    expect(screen.getByText(/need a parent or guardian/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('a parent adding a child under 13 is sent to the consent flow message', async () => {
    await act(() => store().update({ birthMonth: 5, birthYear: 2015 }));
    await render(<WhoScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'My child (under 18)' }));
    expect(screen.getByText(/need a parent's consent first/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});

describe('Chat screen (mockup 03)', () => {
  it('adults can type; the offline parser fills the schedule step', async () => {
    await act(() =>
      store().update({
        birthMonth: 3,
        birthYear: 1983,
        mainGoals: ['look'],
        completedSteps: ['goals'],
      }),
    );
    await render(<ChatScreen />);
    expect(screen.getByText('Where do you train, how long, and how often?')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText('Message to your coach'),
      'Gym, about 40 minutes, 3 days a week.',
    );
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    });
    expect(store()).toMatchObject({ location: 'gym', minutes: 40, daysPerWeek: 3 });
    expect(screen.getByText('Gym, about 40 minutes, 3 days a week.')).toBeTruthy();
  });

  it('children get no free-text box (guided choices only)', async () => {
    await act(() => store().update({ birthMonth: 5, birthYear: 2015 }));
    await render(<ChatScreen />);
    expect(screen.queryByLabelText('Message to your coach')).toBeNull();
    expect(screen.getByText('Tap an option to answer.')).toBeTruthy();
  });

  it('teens get "More fitness / energy" instead of "Lose weight"', async () => {
    await act(() => store().update({ birthMonth: 5, birthYear: 2011 }));
    await render(<ChatScreen />);
    expect(screen.queryByRole('button', { name: 'Lose weight' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More fitness / energy' })).toBeTruthy();
  });

  it('finishing the body step goes to the safety check', async () => {
    await act(() =>
      store().update({
        birthMonth: 3,
        birthYear: 1983,
        completedSteps: ['goals', 'schedule', 'focus'],
      }),
    );
    await render(<ChatScreen />);
    const next = screen.getByRole('button', { name: 'Next: quick safety check' });
    expect(next).toBeDisabled();
    // The neutral body stays hidden until its images exist.
    expect(screen.queryByRole('button', { name: 'Neutral body' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Woman' }));
    await fireEvent.press(next);
    expect(store().sex).toBe('f');
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/safety');
    expect(events.map((e) => e.event)).toContain('chat_completed');
  });
});

describe('Safety screen (mockup 04)', () => {
  it('a red flag shows the doctor notice and needs an acknowledgement', async () => {
    await act(() => store().update({ birthMonth: 3, birthYear: 1983, sex: 'f' }));
    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Heart condition' }));
    expect(screen.getByText('Check with your doctor')).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'I understand' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/profile');
    // The event never carries which condition it was.
    expect(events).toContainEqual({ event: 'safety_red_flag', props: undefined });
  });

  it('"None" clears the selection; pregnancy is hidden for the male body', async () => {
    await act(() => store().update({ birthMonth: 3, birthYear: 1983, sex: 'm' }));
    await render(<SafetyScreen />);
    expect(screen.queryByRole('button', { name: 'Pregnant / postpartum' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Knee' }));
    expect(store().painAreas).toEqual(['knee']);
    await fireEvent.press(screen.getAllByRole('button', { name: 'None' })[0]);
    expect(store().painAreas).toEqual([]);
  });
});

describe('Profile summary (mockup 05)', () => {
  const answers = {
    birthMonth: 3,
    birthYear: 1983,
    sex: 'm' as const,
    heightCm: 177.8,
    weightKg: 83.9,
    units: 'imperial' as const,
    mainGoals: ['look' as const],
    location: 'gym' as const,
    minutes: 40,
    daysPerWeek: 3,
    equipment: ['dumbbells' as const, 'cables' as const, 'bench' as const],
    muscleGoals: [
      { muscleKey: 'upperChest', goal: 'grow' as const },
      { muscleKey: 'chest', goal: 'firm' as const },
    ],
  };

  it('summarizes the interview like the mockup', async () => {
    await act(() => store().update(answers));
    await render(<ProfileScreen />);
    expect(screen.getByText('Mar 1983 · Adult (43)')).toBeTruthy();
    expect(screen.getByText('Man · 5 ft 10 in · 185 lb')).toBeTruthy();
    expect(screen.getByText('Upper chest: Grow · Chest: Firm')).toBeTruthy();
    expect(screen.getByText('40 min · 3 days a week')).toBeTruthy();
    expect(screen.getByText('Gym · Dumbbells, Cables, Bench')).toBeTruthy();
    expect(screen.getByText(/partly body fat/)).toBeTruthy();
  });

  it('teens never see body-fat language', async () => {
    await act(() =>
      store().update({ ...answers, birthYear: 2011, heightCm: undefined, weightKg: undefined }),
    );
    await render(<ProfileScreen />);
    expect(screen.queryByText(/body fat/)).toBeNull();
  });

  it('Edit opens the right step and "Looks right" finishes onboarding', async () => {
    await act(() => store().update(answers));
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Edit: Schedule' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding/chat',
      params: { step: 'schedule', edit: '1' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Looks right' }));
    expect(store().onboardingComplete).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/next');
  });
});
