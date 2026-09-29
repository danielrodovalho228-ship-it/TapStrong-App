/**
 * Security round 2, S2-P2-4: with an account, a teen's birth date moves
 * earlier only through a parent (the server refuses and logs it); the
 * screen says so instead of saving a date the account will never take.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WhoScreen from '@/app/onboarding/who';
import { useAccountStore } from '@/features/account/store';
import { useFamilyStore } from '@/features/family/store';
import { clock } from '@/lib/clock';

import { useOnboardingStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ edit: '1' }),
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null, ensureSession: async () => true }));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const NOTE = /only a parent can move a teen's birth date earlier/;
const realNow = clock.now;

beforeAll(() => {
  clock.now = () => new Date('2026-09-29T12:00:00Z');
});
afterAll(() => {
  clock.now = realNow;
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useFamilyStore.getState().reset();
    useAccountStore.getState().reset();
    useOnboardingStore.getState().update({ who: 'me', birthMonth: 3, birthYear: 2011 });
  });
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

async function enter(month: string, year: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Birth month:/ }));
  await fireEvent.press(screen.getByRole('button', { name: month }));
  await fireEvent.press(screen.getByRole('button', { name: /^Birth year:/ }));
  await fireEvent.press(screen.getByRole('button', { name: year }));
}

it('a teen with an account can not make themselves older', async () => {
  useAccountStore.getState().update({ saved: true });
  await render(<WhoScreen />);
  await enter('April', '2008');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText(NOTE)).toBeTruthy();
  expect(useOnboardingStore.getState().birthYear).toBe(2011);
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('a later date (younger) is fine', async () => {
  useAccountStore.getState().update({ saved: true });
  await render(<WhoScreen />);
  await enter('June', '2011');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByText(NOTE)).toBeNull();
  expect(useOnboardingStore.getState().birthMonth).toBe(6);
});

it('without an account (nothing on the server yet) a wrong date can still be fixed', async () => {
  await render(<WhoScreen />);
  await enter('April', '2008');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByText(NOTE)).toBeNull();
  expect(useOnboardingStore.getState().birthYear).toBe(2008);
});
