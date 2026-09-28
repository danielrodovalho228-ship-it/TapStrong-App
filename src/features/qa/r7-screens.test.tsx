/**
 * QA round 7 — P2 (screens): unknown routes, accessibility and copy.
 */
import { act, render, screen } from '@testing-library/react-native';

import NotFoundScreen from '@/app/+not-found';
import DayScreen from '@/app/day/[date]';
import ExerciseScreen from '@/app/exercise/[id]';
import RestScreen from '@/app/workout/[id]/rest';
import { Checkbox } from '@/components/ui/Checkbox';
import { whoErrorKey } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import i18n from '@/i18n';
import { clock } from '@/lib/clock';
import { setKidsUnder13Enabled } from '@/lib/features';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
  Stack: { Screen: () => null },
}));

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T09:00:00');
});
beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      onboardingComplete: true,
      location: 'home',
      minutes: 30,
      daysPerWeek: 3,
    });
  });
});

it('an unknown address shows "Page not found" and Back to Home', async () => {
  await render(<NotFoundScreen />);
  expect(screen.getByRole('header', { name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back to Home' })).toBeTruthy();
});

it('an unknown workout rest page goes Home, not blank', async () => {
  mockParams = { id: 'nope' };
  await render(<RestScreen />);
  expect(screen.getByText('redirect:/home')).toBeTruthy();
});

it('an unknown exercise says "Exercise not found"', async () => {
  mockParams = { id: 'nope' };
  await render(<ExerciseScreen />);
  expect(screen.getByText(/Exercise not found/)).toBeTruthy();
});

it('/day/not-a-date is not found; a real date still works', async () => {
  mockParams = { date: 'not-a-date' };
  await render(<DayScreen />);
  expect(screen.getByText(/This page doesn't exist/)).toBeTruthy();
  mockParams = { date: '2026-09-30' };
  await render(<DayScreen />);
  expect(screen.queryByText(/This page doesn't exist/)).toBeNull();
});

it('Checkbox states its checked value (aria-checked on the web)', async () => {
  await render(<Checkbox label="Save Knee" checked onChange={() => undefined} />);
  expect(screen.getByRole('checkbox', { name: 'Save Knee' })).toBeChecked();
});

it('with kids off, "My teen" copy says 13–17', () => {
  setKidsUnder13Enabled(false);
  expect(i18n.t(whoErrorKey('child_too_old'))).toMatch(/13–17/);
  expect(i18n.t('who.birth.teen')).toBe("Your teen's birth month and year");
  setKidsUnder13Enabled(true);
});
