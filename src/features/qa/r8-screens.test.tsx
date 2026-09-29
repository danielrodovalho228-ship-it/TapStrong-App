/**
 * QA round 8 — P2 (screens): not-found pages are never dead ends.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DayScreen from '@/app/day/[date]';
import ExerciseScreen from '@/app/exercise/[id]';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
  Stack: { Screen: () => null },
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T09:00:00');
});
beforeEach(async () => {
  Object.values(router).forEach((m) => m.mockClear?.());
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      onboardingComplete: true,
      location: 'home',
      minutes: 30,
    });
  });
});

it.each([
  ['an unknown exercise', ExerciseScreen, { id: 'nope' }],
  ['an invalid day', DayScreen, { date: 'not-a-date' }],
])('%s opened directly goes Home, from Back and from the button', async (_n, Screen, params) => {
  mockParams = params;
  await render(<Screen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
  expect(router.replace).toHaveBeenCalledWith('/home');
  router.replace.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(router.replace).toHaveBeenCalledWith('/home');
  expect(router.back).not.toHaveBeenCalled();
});
