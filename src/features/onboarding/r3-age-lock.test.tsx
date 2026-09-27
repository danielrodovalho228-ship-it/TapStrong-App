/**
 * QA R3-01 — the under-13 stop is only for the self-signup "Me" flow before
 * an account exists. It never blocks family profiles or an edit, it lifts
 * once the date entered turns 13, and it has a support path.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import WhoScreen from '@/app/onboarding/who';
import { useAccountStore } from '@/features/account/store';
import { useFamilyStore } from '@/features/family/store';
import { clock } from '@/lib/clock';
import { setKidsUnder13Enabled } from '@/lib/features';

import { ageLockApplies, isAgeBlocked, useAgeBlockStore } from './ageBlock';
import { useOnboardingStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null, ensureSession: async () => true }));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const TITLE = 'TapStrong is for ages 13 and up';

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

beforeEach(async () => {
  setKidsUnder13Enabled(false);
  mockParams = {};
  await act(() => {
    useOnboardingStore.getState().reset();
    useFamilyStore.getState().reset();
    useAccountStore.getState().reset();
    useAgeBlockStore.getState().reset();
  });
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

afterAll(() => setKidsUnder13Enabled(true));

async function enter(month: string, year: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Birth month:/ }));
  await fireEvent.press(screen.getByRole('button', { name: month }));
  await fireEvent.press(screen.getByRole('button', { name: /^Birth year:/ }));
  await fireEvent.press(screen.getByRole('button', { name: year }));
}

describe('when the stop applies', () => {
  it('only self-signup "Me", not editing, no account, not a family profile', () => {
    const base = { who: 'me', editing: false, accountSaved: false, familyProfile: false };
    expect(ageLockApplies(base)).toBe(true);
    expect(ageLockApplies({ ...base, who: 'child' })).toBe(false);
    expect(ageLockApplies({ ...base, editing: true })).toBe(false);
    expect(ageLockApplies({ ...base, accountSaved: true })).toBe(false);
    expect(ageLockApplies({ ...base, familyProfile: true })).toBe(false);
  });

  it('expires once the stored birth date turns 13', () => {
    const birth = { year: 2014, month: 5 };
    expect(isAgeBlocked(birth, { year: 2027, month: 4 })).toBe(true);
    expect(isAgeBlocked(birth, { year: 2027, month: 5 })).toBe(false);
    expect(isAgeBlocked(null)).toBe(false);
  });
});

describe('who screen', () => {
  it('self-signup under 13: the stop, with a support link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<WhoScreen />);
    await enter('May', '2016');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Contact support' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^mailto:/));
    open.mockRestore();
  });

  it('the stop lifts by itself when that date turns 13', async () => {
    await act(() => useAgeBlockStore.getState().block({ year: 2016, month: 5 }));
    await render(<WhoScreen />);
    expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
    clock.now = () => new Date('2029-05-02T12:00:00Z');
    await render(<WhoScreen />);
    expect(screen.queryByRole('header', { name: TITLE })).toBeNull();
    clock.now = () => new Date('2026-09-26T12:00:00Z');
  });

  it('a family profile created by the owner is never blocked by an earlier stop', async () => {
    await act(() => {
      useAgeBlockStore.getState().block({ year: 2016, month: 5 });
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          { id: 'g1', kind: 'parent', name: 'Rosa', createdAt: '2026-09-20T00:00:00Z' },
        ],
        activeId: 'g1',
      });
      useOnboardingStore.getState().update({ who: 'me', birthMonth: 3, birthYear: 1950 });
    });
    await render(<WhoScreen />);
    expect(screen.queryByRole('header', { name: TITLE })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/chat');
  });

  it('an adult mistyping 2016 in "Edit: Born" gets a message, not a phone-wide lock', async () => {
    mockParams = { edit: '1' };
    await act(() => useOnboardingStore.getState().update({ who: 'me', birthMonth: 3 }));
    await render(<WhoScreen />);
    await enter('March', '2016');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('header', { name: TITLE })).toBeNull();
    expect(screen.getByText('TapStrong is for ages 13 and up.')).toBeTruthy();
    expect(useAgeBlockStore.getState().birth).toBeNull();
    expect(useOnboardingStore.getState().birthYear).toBeUndefined();
    await enter('March', '2012');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('with a saved account the stop is not shown', async () => {
    await act(() => {
      useAgeBlockStore.getState().block({ year: 2016, month: 5 });
      useAccountStore.getState().update({ saved: true });
    });
    await render(<WhoScreen />);
    expect(screen.queryByRole('header', { name: TITLE })).toBeNull();
  });
});
