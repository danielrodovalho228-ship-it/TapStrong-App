/**
 * QA round 10 P2: on a weekly-limit day Home says so, not "Everything is
 * recovering" (adult Home and 60+ Home).
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { clock } from '@/lib/clock';

import { useWorkoutStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
let mockError: string | undefined;
jest.mock('./plan', () => {
  const actual = jest.requireActual('./plan');
  return {
    ...actual,
    todaySession: (...args: unknown[]) => {
      const s = actual.todaySession(...args);
      return mockError ? { ...s, items: [], error: mockError } : s;
    },
  };
});

async function profile(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      daysPerWeek: 4,
      minutes: 30,
      location: 'home',
      position: 'standing',
      mainGoals: ['strength'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      onboardingComplete: true,
    });
    useWorkoutStore.getState().reset();
    useProgressStore.getState().reset();
  });
}

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T09:00:00');
});
afterEach(() => {
  mockError = undefined;
});

it.each([
  ['adult', 1990],
  ['60+', 1955],
])('%s Home on a weekly-limit day names the limit', async (_, year) => {
  await profile(year);
  mockError = 'weekly_cap';
  await render(<HomeScreen />);
  expect(screen.getByRole('header', { name: "You've reached this week's limit" })).toBeTruthy();
  expect(screen.getByText(/have had their sets for this week/)).toBeTruthy();
  expect(screen.queryByText('Everything is recovering')).toBeNull();
  // The one big action: short mobility, "Stretch now" on the plan (Phase 31);
  // the 60+ Home keeps short balance when it can be built.
  expect(
    screen.getByRole('button', { name: /^(Short (mobility|balance)|Stretch now)/ }),
  ).toBeTruthy();
});

it('an all-recovering day keeps its own words', async () => {
  await profile(1990);
  mockError = 'all_recovering';
  await render(<HomeScreen />);
  expect(screen.getByRole('header', { name: 'Everything is recovering' })).toBeTruthy();
});
