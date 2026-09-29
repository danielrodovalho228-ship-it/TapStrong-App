/**
 * QA round 10: a failed session restore never locks the owner out of the PIN
 * reset (R10-03); the email code has its own counter (decision 1); the wait
 * and lock messages say how long (P2).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/account';
import { useAccountStore } from '@/features/account/store';
import { clock } from '@/lib/clock';

import { ParentGate } from './ParentGate';
import { checkParentPin, setParentPin, useParentPinStore } from './parentPin';
import { useOwnerIdentityStore } from './ownerIdentity';
import { useResetCodeStore } from './resetCodeLock';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/features/account/cloud', () => ({
  afterAccountSaved: jest.fn(async () => undefined),
  syncNow: jest.fn(async () => ({ status: 'ok', synced: [], skipped: [] })),
  loadReferralCode: jest.fn(async () => null),
  referralLink: (code: string) => `tapstrong://r/${code}`,
}));

const mockAuth = {
  signInWithOtp: jest.fn(async () => ({ error: null as unknown })),
  updateUser: jest.fn(async () => ({ error: null })),
  signInAnonymously: jest.fn(async () => ({ error: null })),
  verifyOtp: jest.fn(async ({ token }: { token: string }) => ({
    data: { user: token === '123456' ? { id: 'owner-user' } : null },
    error: token === '123456' ? null : { code: 'otp_expired', status: 403 },
  })),
  getUser: jest.fn(async () => ({ data: { user: null } })),
  getSession: jest.fn(async () => ({
    data: { session: { access_token: 'a', refresh_token: 'r' } } as unknown,
  })),
  signOut: jest.fn(async () => ({ error: null })),
  // The refresh token expired while the phone was away.
  setSession: jest.fn(async () => ({ error: { status: 400 } as unknown })),
};
jest.mock('@/lib/supabase', () => {
  const actual = jest.requireActual('@/lib/supabase');
  return {
    getSupabase: () => ({ auth: mockAuth }),
    ensureSession: (c: never) => actual.ensureSession(c),
  };
});

const NOW = new Date('2026-09-29T12:00:00Z');
const realNow = clock.now;
beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});

beforeEach(async () => {
  await act(() => {
    useParentPinStore.getState().reset();
    useResetCodeStore.getState().reset();
    setParentPin('2468');
    useAccountStore.getState().reset();
    useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
    useOwnerIdentityStore.setState({
      ownerId: 'me',
      activeId: 't1',
      minors: { t1: 'teen' },
      ownerAuth: { email: 'dan@example.com', userId: 'owner-user' },
    });
    useFamilyStore.setState({
      profiles: [
        { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
        { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
      ],
      activeId: 't1',
    });
  });
  Object.values(mockAuth).forEach((m) => m.mockClear());
});

async function toCode() {
  await fireEvent.press(screen.getByRole('link', { name: 'Forgot the PIN?' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));
}
const confirm = async (code: string) => {
  await fireEvent.changeText(screen.getByLabelText('Code from the email'), code);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm the code' }));
};

describe('R10-03 a failed restore never locks the owner out', () => {
  it('restore fails → the new PIN can be set → Account asks to sign in again, without an anonymous user', async () => {
    const onPass = jest.fn();
    await render(<ParentGate onPass={onPass} />);
    await toCode();
    await confirm('123456');
    expect(screen.getByText(/this phone was signed out of the account/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '1357');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '1357');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(onPass).toHaveBeenCalled();
    expect(checkParentPin('1357', NOW)).toBe('ok');
    expect(useAccountStore.getState()).toMatchObject({ saved: false, needsSignIn: true });

    // With the new PIN the owner is back on their profile and opens Account.
    await act(() => {
      useOwnerIdentityStore.setState({ activeId: 'me' });
      useFamilyStore.setState({ activeId: 'me' });
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await render(<AccountScreen />);
    expect(
      screen.getByText('This phone was signed out. Enter your email to sign in again.'),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'dan@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(mockAuth.signInWithOtp).toHaveBeenLastCalledWith({
      email: 'dan@example.com',
      options: { shouldCreateUser: false },
    });
    mockAuth.getSession.mockReset();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'a', refresh_token: 'r' } },
    });
  });
});

describe('R10 P2 code limits in the UI', () => {
  it('a second send says how many seconds to wait', async () => {
    await render(<ParentGate onPass={jest.fn()} />);
    await toCode();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot the PIN?' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));
    expect(screen.getByText('Wait 60 seconds before asking for another code.')).toBeTruthy();
  });

  it('5 wrong codes: "N minutes" and Confirm disabled; the PIN itself is not locked', async () => {
    await render(<ParentGate onPass={jest.fn()} />);
    await toCode();
    for (let n = 0; n < 5; n++) await confirm('999999');
    expect(screen.getByText('Too many wrong codes. Try again in 15 minutes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm the code' })).toBeDisabled();
    expect(checkParentPin('2468', NOW)).toBe('ok');
    // A minute before the end it says 1 minute, not 15.
    const later = new Date(NOW.getTime() + 14 * 60000 + 1000);
    clock.now = () => later;
    try {
      await render(<ParentGate onPass={jest.fn()} />);
      await toCode();
      expect(screen.getByText('Too many wrong codes. Try again in 1 minute.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Confirm the code' })).toBeDisabled();
    } finally {
      clock.now = () => NOW;
    }
  });
});
