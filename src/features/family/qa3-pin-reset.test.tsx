/**
 * Phase 12 — forgotten parent PIN: reset with a code sent to the account
 * owner's email, then a new PIN.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAccountStore } from '@/features/account/store';
import { clock } from '@/lib/clock';

import { ParentGate } from './ParentGate';
import { checkParentPin, setParentPin, useParentPinStore } from './parentPin';
import { maskEmail } from './pinReset';
import { useFamilyStore } from './store';

const mockAuth = {
  signInWithOtp: jest.fn(async () => ({ error: null as unknown })),
  verifyOtp: jest.fn(async ({ token }: { token: string }) => ({
    error: token === '123456' ? null : { code: 'otp_expired', status: 403 },
  })),
};
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: mockAuth }),
  ensureSession: async () => true,
}));

const NOW = new Date('2026-09-27T12:00:00Z');

beforeAll(() => {
  clock.now = () => NOW;
});

beforeEach(async () => {
  await act(() => {
    useParentPinStore.getState().reset();
    setParentPin('2468');
    useAccountStore.getState().reset();
    useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
    // A teen profile is active: the owner can't switch without the PIN.
    useFamilyStore.setState({
      profiles: [
        { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
        { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
      ],
      activeId: 't1',
    });
  });
  mockAuth.signInWithOtp.mockClear();
  mockAuth.verifyOtp.mockClear();
});

describe('forgotten parent PIN', () => {
  it('masks the owner email', () => {
    expect(maskEmail('dan@example.com')).toBe('d•••@example.com');
  });

  it('an email code to the owner, then a new PIN', async () => {
    const onPass = jest.fn();
    await render(<ParentGate onPass={onPass} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot the PIN?' }));
    expect(screen.getByText(/d•••@example.com/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'dan@example.com',
      options: { shouldCreateUser: false },
    });
    // A wrong code does not get through.
    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '999999');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm the code' }));
    expect(screen.getByText(/That code didn’t work/)).toBeTruthy();
    expect(onPass).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm the code' }));
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '1357');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '1357');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(onPass).toHaveBeenCalled();
    expect(checkParentPin('1357', NOW)).toBe('ok');
    expect(checkParentPin('2468', NOW)).toBe('wrong');
  });

  it('also clears a lockout once the new PIN is set', async () => {
    for (let i = 0; i < 5; i++) checkParentPin('0000', NOW);
    expect(checkParentPin('2468', NOW)).toBe('locked');
    setParentPin('1357');
    expect(checkParentPin('1357', NOW)).toBe('ok');
  });

  it('without a saved account there is nothing to send a code to', async () => {
    await act(() => useAccountStore.getState().update({ saved: false, email: undefined }));
    await render(<ParentGate onPass={jest.fn()} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot the PIN?' }));
    expect(screen.getByText(/Only the account owner can reset the PIN/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send the code' })).toBeNull();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });
});
