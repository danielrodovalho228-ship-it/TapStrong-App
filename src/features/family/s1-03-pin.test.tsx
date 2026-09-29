/**
 * Security round 1, S1-03 (Daniel's decision): the parent PIN is checked on
 * the server; the phone's copy is only an offline fallback on native; the web
 * never checks a PIN on its own and has no family profiles for now.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useAccountStore } from '@/features/account/store';
import { buy } from '@/features/billing/actions';
import { PRODUCTS } from '@/features/billing/rules';
import { clock } from '@/lib/clock';

import { ParentGate, ParentPinSetup } from './ParentGate';
import { checkParentPin, lockMinutesLeft, setParentPin, useParentPinStore } from './parentPin';
import { pullPinStatus, savePin, verifyPin } from './pinLockout';
import { useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), auth: {} }),
  ensureSession: async () => true,
}));

const NOW = new Date('2026-09-29T12:00:00Z');
const realNow = clock.now;
const client = () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) as never;
const until = (min: number) => new Date(NOW.getTime() + min * 60000).toISOString();

/** A server with a PIN, its own lockout and version (security round 2, S2-P2-2). */
function server(pin = '2468') {
  let failures = 0;
  let lockedUntil: string | null = null;
  let current: string | null = pin || null;
  let version = 1;
  let windowOpen = false;
  const row = (result: string) => ({
    data: [
      {
        result,
        failures,
        locked_until: lockedUntil,
        pin_version: current ? `v${version}` : null,
      },
    ],
    error: null,
  });
  const check = (given?: string) => {
    if (lockedUntil) return 'locked';
    if (given === current) {
      failures = 0;
      return 'ok';
    }
    failures++;
    if (failures >= 5) {
      failures = 0;
      lockedUntil = until(15);
      return 'locked';
    }
    return 'wrong';
  };
  mockRpc.mockImplementation(
    async (name: string, args?: { pin?: string; new_pin?: string; old_pin?: string }) => {
      if (name === 'parent_pin_status')
        return { data: [{ has_pin: !!current, locked_until: lockedUntil }], error: null };
      if (name === 'verify_parent_pin') {
        if (!current && !lockedUntil) return row('no_pin');
        return row(check(args?.pin));
      }
      if (name === 'open_pin_reset_window') {
        windowOpen = true;
        return { data: true, error: null };
      }
      if (name === 'set_parent_pin') {
        if (current && !windowOpen) {
          if (!args?.old_pin) return { data: 'reauth', error: null };
          const r = check(args.old_pin);
          if (r !== 'ok') return { data: r, error: null };
        }
        current = args?.new_pin ?? null;
        version++;
        windowOpen = false;
        lockedUntil = null;
        return { data: 'ok', error: null };
      }
      return { data: null, error: null };
    },
  );
  return {
    get pin() {
      return current;
    },
    /** The PIN changed from another phone. */
    change(next: string) {
      current = next;
      version++;
    },
  };
}

beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});

beforeEach(async () => {
  mockRpc.mockReset();
  await act(() => {
    useParentPinStore.getState().reset();
    useAccountStore.getState().reset();
    useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
    useFamilyStore.setState({
      profiles: [
        { id: 'owner', kind: 'self', createdAt: '' },
        { id: 'teen', kind: 'child', createdAt: '' },
      ],
      activeId: 'teen',
    });
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'teen',
      minors: { teen: 'teen' },
      ownerAuth: { email: 'dan@example.com', userId: 'owner-user' },
    });
  });
});

describe('the server decides', () => {
  it('a phone with no PIN of its own learns it from the account, and the server checks it', async () => {
    server('2468');
    await pullPinStatus(client());
    expect(useParentPinStore.getState()).toMatchObject({ hash: null, serverHasPin: true });
    expect(await verifyPin(client(), '1111')).toBe('wrong');
    expect(useParentPinStore.getState().failures).toBe(1);
    expect(await verifyPin(client(), '2468')).toBe('ok');
    // The offline copy is made once.
    expect(useParentPinStore.getState().hash).not.toBeNull();
  });

  it('clearing or editing the phone copy changes nothing: the lock and the PIN live on the server', async () => {
    server('2468');
    for (let n = 0; n < 5; n++) await verifyPin(client(), '0000');
    expect(lockMinutesLeft(NOW)).toBe(15);
    // A teen wipes the lock and plants their own PIN in the phone's storage.
    setParentPin('1357');
    useParentPinStore.setState({ failures: 0, lockedUntil: null });
    expect(await verifyPin(client(), '1357')).toBe('locked');
    expect(await verifyPin(client(), '2468')).toBe('locked');
  });

  it('the gate shows the server count and never reports a right PIN itself', async () => {
    server('2468');
    const onPass = jest.fn();
    await render(<ParentGate onPass={onPass} />);
    await fireEvent.changeText(screen.getByLabelText('Parent PIN'), '1111');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText(/4 tries left/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(onPass).toHaveBeenCalled();
    const names = mockRpc.mock.calls.map((c) => c[0]);
    expect(names).toContain('verify_parent_pin');
    expect(names).not.toContain('parent_pin_passed');
  });
});

describe('changing the PIN', () => {
  it('without the right PIN or the email code the server refuses; Setup moves to the email code', async () => {
    const s = server('2468');
    expect(await savePin(client(), '9999')).toBe('reauth');
    expect(s.pin).toBe('2468');
    await render(<ParentPinSetup onDone={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '9999');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '9999');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(screen.getByRole('button', { name: 'Send the code' })).toBeTruthy();
  });

  it('a right PIN alone opens no window: without the current PIN the server refuses (S2-P2-2)', async () => {
    const s = server('2468');
    expect(await verifyPin(client(), '2468')).toBe('ok');
    expect(await savePin(client(), '1357')).toBe('reauth');
    expect(await savePin(client(), '1357', '0000')).toBe('wrong');
    expect(s.pin).toBe('2468');
    expect(await savePin(client(), '1357', '2468')).toBe('ok');
    expect(s.pin).toBe('1357');
  });

  it('Settings: the gate hands over the PIN it checked', async () => {
    server('2468');
    const onPass = jest.fn();
    await render(<ParentGate onPass={onPass} />);
    await fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(onPass).toHaveBeenCalledWith('2468');
  });

  it('Settings: Setup sends the checked PIN as proof', async () => {
    const s = server('2468');
    await render(<ParentPinSetup oldPin="2468" onDone={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '1357');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '1357');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(s.pin).toBe('1357');
  });

  it('the email-code window works once', async () => {
    const s = server('2468');
    await mockRpc('open_pin_reset_window');
    expect(await savePin(client(), '1357')).toBe('ok');
    expect(await savePin(client(), '9753')).toBe('reauth');
    expect(s.pin).toBe('1357');
  });

  it('offline: an account PIN is never changed on the phone alone', async () => {
    useParentPinStore.setState({ serverHasPin: true });
    mockRpc.mockRejectedValue(new TypeError('Network request failed'));
    expect(await savePin(client(), '1357')).toBe('offline');
    expect(useParentPinStore.getState().hash).toBeNull();
  });

  it('offline first PIN (native): kept on the phone and sent once online', async () => {
    mockRpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await savePin(client(), '1357')).toBe('ok');
    expect(useParentPinStore.getState().pendingPin).toBe('1357');
    const s = server('');
    await pullPinStatus(client());
    expect(s.pin).toBe('1357');
    expect(useParentPinStore.getState()).toMatchObject({ pendingPin: null, serverHasPin: true });
  });
});

describe('the offline copy follows the account (S2-P2-3)', () => {
  it('a PIN changed on another phone replaces the old copy here', async () => {
    const s = server('2468');
    expect(await verifyPin(client(), '2468')).toBe('ok');
    s.change('1357');
    expect(await verifyPin(client(), '1357')).toBe('ok');
    // Offline, the phone's copy now accepts only the new PIN.
    expect(checkParentPin('1357')).toBe('ok');
    expect(checkParentPin('2468')).toBe('wrong');
  });

  it('the server says wrong: a stale copy that accepts that PIN is dropped', async () => {
    const s = server('2468');
    expect(await verifyPin(client(), '2468')).toBe('ok');
    s.change('1357');
    expect(await verifyPin(client(), '2468')).toBe('wrong');
    expect(useParentPinStore.getState().hash).toBeNull();
  });

  it('a reset whose session did not come back: the PIN is sent once signed in again', async () => {
    const s = server('2468');
    // ok_signed_out: the account is marked signed out, the owner is known.
    useAccountStore.getState().update({ saved: false, needsSignIn: true });
    expect(await savePin(client(), '1357')).toBe('ok');
    expect(useParentPinStore.getState().pendingPin).toBe('1357');
    expect(s.pin).toBe('2468');
    // Signing in again from Account with the email code.
    useAccountStore.getState().update({ saved: true, needsSignIn: false });
    await pullPinStatus(client());
    expect(s.pin).toBe('1357');
    expect(useParentPinStore.getState().pendingPin).toBeNull();
    expect(await verifyPin(client(), '1357')).toBe('ok');
  });
});

describe('offline fallback', () => {
  it('native: the phone copy answers when the server is unreachable', async () => {
    setParentPin('2468');
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Network request failed' },
    });
    expect(await verifyPin(client(), '2468')).toBe('ok');
    expect(await verifyPin(client(), '1111')).toBe('wrong');
  });

  it('web: never checks a PIN on its own', async () => {
    setParentPin('2468');
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      mockRpc.mockRejectedValue(new TypeError('Network request failed'));
      expect(await verifyPin(client(), '2468')).toBe('offline');
      useAccountStore.getState().update({ saved: false });
      expect(await verifyPin(client(), '2468')).toBe('offline');
    } finally {
      os.restore();
    }
  });
});

describe('web: family profiles are mobile-only', () => {
  let os: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    os = jest.replaceProperty(Platform, 'OS', 'web');
  });
  afterEach(() => os.restore());

  it('the parent gate shows the note, never a PIN field', async () => {
    await render(<ParentGate onPass={jest.fn()} />);
    expect(screen.getByText('Family profiles are available in the mobile app.')).toBeTruthy();
    expect(screen.queryByLabelText('Parent PIN')).toBeNull();
  });

  it('a Family purchase is refused on the web', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [{ id: 'owner', kind: 'self', createdAt: '' }],
        activeId: 'owner',
      });
      useOwnerIdentityStore.setState({ activeId: 'owner', minors: {} });
    });
    expect(await buy(PRODUCTS.family.monthly)).toBe('unavailable');
  });
});

describe('forgotten PIN', () => {
  it("the window opens while the code's own session is active, before it is signed out", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reset = require('./pinReset') as typeof import('./pinReset');
    const order: string[] = [];
    const c = {
      rpc: jest.fn(async (name: string) => {
        order.push(name);
        return { data: name === 'open_pin_reset_window' ? true : null, error: null };
      }),
      auth: {
        verifyOtp: jest.fn(async () => {
          order.push('verifyOtp');
          return { data: { user: { id: 'owner-user' } }, error: null };
        }),
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'a', refresh_token: 'r' } },
        })),
        signOut: jest.fn(async () => {
          order.push('signOut');
          return { error: null };
        }),
        setSession: jest.fn(async () => ({ error: null })),
      },
    } as never;
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
    expect(order.indexOf('open_pin_reset_window')).toBeGreaterThan(order.indexOf('verifyOtp'));
    expect(order.indexOf('open_pin_reset_window')).toBeLessThan(order.indexOf('signOut'));
    expect(order).not.toContain('pin_reset_code_passed');
  });
});
