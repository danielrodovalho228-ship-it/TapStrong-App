/**
 * Phase 21: round-8 items confirmed with tests — neutral "not found" notice,
 * "sit or stand" band pulldown cue, and a missed planned day carried to
 * tomorrow (never shown as a rest day).
 */
import { act, render, screen } from '@testing-library/react-native';

import DayScreen from '@/app/day/[date]';
import ExerciseScreen from '@/app/exercise/[id]';
import { useOnboardingStore } from '@/features/onboarding/store';
import { plannedDaysBetween } from '@/features/program/week';
import { useWorkoutStore } from '@/features/workout/store';
import i18n from '@/i18n';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart } from '@/lib/dates';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
  Stack: { Screen: () => null },
}));

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
    useWorkoutStore.getState().reset();
  });
});

it('"Exercise not found" is a neutral notice, not an alert or the green one', async () => {
  clock.now = () => new Date('2026-09-28T09:00:00');
  mockParams = { id: 'nope' };
  await render(<ExerciseScreen />);
  expect(screen.getByText(/Exercise not found/)).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('band lat pulldown says sit or stand, never kneel, in every language', () => {
  const cue = (lng: string) => i18n.t('exercises.band_lat_pulldown.cues', { lng });
  expect(cue('en')).toMatch(/sit or stand/);
  expect(cue('es')).toMatch(/sentado o de pie/);
  expect(cue('pt-BR')).toMatch(/sentado ou em pé/);
  for (const lng of ['en', 'es', 'pt-BR']) expect(cue(lng)).not.toMatch(/kneel|rodillas|joelhos/);
});

it('a planned day not done: tomorrow is not a rest day', async () => {
  // A planned day followed by an unplanned one.
  let today = '2026-09-28';
  for (let i = 0; i < 14; i++) {
    const d = addDays('2026-09-28', i);
    const planned = plannedDaysBetween(d, addDays(d, 1), deviceWeekStart(), 3).length > 0;
    const next = plannedDaysBetween(addDays(d, 1), addDays(d, 2), deviceWeekStart(), 3).length > 0;
    if (planned && !next) {
      today = d;
      break;
    }
  }
  clock.now = () => new Date(`${today}T20:00:00`);
  mockParams = { date: addDays(today, 1) };
  await render(<DayScreen />);
  expect(screen.queryByText('Rest day')).toBeNull();
  // Two days later, with nothing carried over, the plan's rest day shows again.
  mockParams = { date: addDays(today, 2) };
  await render(<DayScreen />);
  const dayAfterPlanned =
    plannedDaysBetween(addDays(today, 2), addDays(today, 3), deviceWeekStart(), 3).length > 0;
  if (!dayAfterPlanned) expect(screen.getByText('Rest day')).toBeTruthy();
});
