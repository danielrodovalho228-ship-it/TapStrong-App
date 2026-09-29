/**
 * Security round 1, S2-07: the Account email code — one a minute, and 5 wrong
 * codes lock that email for 15 minutes (on the phone and on the server).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/account';
import { clock } from '@/lib/clock';

import { sendEmailCode, verifyEmailCode } from './auth';
import { lockMinutesLeft, sendWaitSeconds, useAccountCodeStore } from './codeLimits';
import { useAccountStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => mockClient,
  ensureSession: async () => true,
}));
jest.mock('@/features/account/cloud', () => ({
  afterAccountSaved: jest.fn(async () => undefined),
  syncNow: jest.fn(async () => ({ status: 'ok', synced: [], skipped: [] })),
  loadReferralCode: jest.fn(async () => null),
  referralLink: (code: string) => `tapstrong://r/${code}`,
}));

const rpc = jest.fn(async (_name: string, _args?: unknown) => ({
  data: null as string | null,
  error: null,
}));
const mockClient = {
  rpc,
  auth: {
    updateUser: jest.fn(async () => ({ error: null })),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ error: { code: 'otp_expired', status: 403 } })),
  },
} as never;

const NOW = new Date('2026-09-29T12:00:00Z');
const realNow = clock.now;
beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});
beforeEach(async () => {
  rpc.mockClear();
  await act(() => {
    useAccountCodeStore.getState().reset();
    useAccountStore.getState().reset();
  });
});

it('one code a minute; a clock set back still waits', async () => {
  expect((await sendEmailCode(mockClient, 'me@example.com')).status).toBe('sent');
  expect(await sendEmailCode(mockClient, 'me@example.com')).toEqual({
    status: 'wait',
    seconds: 60,
  });
  const back = new Date(NOW.getTime() - 3_600_000);
  expect(sendWaitSeconds(back)).toBe(60);
  expect(sendWaitSeconds(new Date(NOW.getTime() + 61_000))).toBe(0);
});

it('5 wrong codes lock that email for 15 minutes, counted on the server too', async () => {
  const results = [];
  for (let n = 0; n < 6; n++)
    results.push(await verifyEmailCode(mockClient, 'Me@Example.com', '111111', 'upgrade'));
  expect(results.slice(0, 4).every((r) => r === 'wrong_code')).toBe(true);
  expect(results[4]).toBe('locked');
  expect(results[5]).toBe('locked');
  expect(lockMinutesLeft('me@example.com')).toBe(15);
  expect(rpc).toHaveBeenCalledWith('account_code_failed', { email: 'me@example.com' });
  // Another email isn't locked.
  expect(lockMinutesLeft('other@example.com')).toBe(0);
});

it('a lock kept on the server applies after clearing the app', async () => {
  const until = new Date(NOW.getTime() + 10 * 60000).toISOString();
  rpc.mockImplementation(async (name: string) => ({
    data: name === 'account_code_locked_until' ? until : null,
    error: null,
  }));
  expect(await verifyEmailCode(mockClient, 'me@example.com', '123456', 'upgrade')).toBe('locked');
  rpc.mockImplementation(async () => ({ data: null, error: null }));
});

it('the Account screen says how long, and Confirm is disabled while locked', async () => {
  await render(<AccountScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  for (let n = 0; n < 5; n++) {
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '111111');
    await fireEvent.press(screen.getByRole('button', { name: 'Save my progress' }));
  }
  expect(screen.getByText('Too many wrong codes. Try again in 15 minutes.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save my progress' })).toBeDisabled();
  // Going back: no new code for this email while locked (round 2, S2-P2-5).
  await fireEvent.press(screen.getByRole('link', { name: 'Use a different email' }));
  expect(screen.getByRole('button', { name: 'Email me a code' })).toBeDisabled();
  expect(screen.getByText('Too many wrong codes. Try again in 15 minutes.')).toBeTruthy();
  // Another email: only the minute between codes.
  await fireEvent.changeText(screen.getByLabelText('Email'), 'other@example.com');
  expect(screen.getByText('Wait 60 seconds before asking for another code.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Email me a code' })).toBeDisabled();
});
