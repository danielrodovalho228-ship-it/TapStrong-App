/**
 * QA round 8 — safety P1: a profile switch keeps a locked teen's hidden
 * answers (R8-01); a too-young, deleted or invalid birth date can't lift the
 * teen lock (R8-02); a v1-upgraded phone not yet proven by the PIN still
 * applies the lock (R8-03).
 */
import '@/i18n';

import { act } from '@testing-library/react-native';

import { derive, FALLBACK_MODE, modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { activeMinorLock, useOwnerIdentityStore } from './ownerIdentity';
import { useParentPinStore } from './parentPin';
import { useFamilyStore } from './store';
import { ensureSelfProfile, switchProfile } from './switch';

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T10:00:00Z');
});

async function setup() {
  await act(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
  });
  await act(() => ensureSelfProfile());
  await act(() =>
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1985, sex: 'f' }),
  );
}

describe('R8-01 switching away and back', () => {
  it('a locked teen keeps pregnancy + osteoporosis on a boy body model', async () => {
    await setup();
    await act(() => {
      useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Ana' });
    });
    await act(() =>
      switchProfile('teen-1', { birthMonth: 3, birthYear: 2010, sex: 'f', safetyDone: true }),
    );
    await act(() =>
      useOnboardingStore
        .getState()
        .update({ conditions: ['osteoporosis', 'pregnant_postpartum'], position: 'seated_only' }),
    );
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'm' }));
    expect(useOnboardingStore.getState().conditions).toContain('pregnant_postpartum');

    const self = useFamilyStore.getState().profiles.find((p) => p.kind === 'self')!;
    await act(() => switchProfile(self.id));
    expect(useOnboardingStore.getState().birthYear).toBe(1985);
    await act(() => switchProfile('teen-1'));

    const s = useOnboardingStore.getState();
    expect(s.conditions).toEqual(['osteoporosis', 'pregnant_postpartum']);
    expect(s.position).toBe('seated_only');
    expect(s.sex).toBe('m');
  });

  it.each(['self', 'parent', 'child'] as const)(
    'every safety answer survives for a %s profile',
    async (kind) => {
      await setup();
      const self = useFamilyStore.getState().profiles.find((p) => p.kind === 'self')!;
      await act(() =>
        useOnboardingStore.getState().update({
          painAreas: ['knee', 'lower_back'],
          conditions: ['diabetes', 'pregnant_postpartum'],
          position: 'with_support',
          redFlagAcknowledged: true,
        }),
      );
      const saved = (({ painAreas, conditions, position, redFlagAcknowledged }) => ({
        painAreas,
        conditions,
        position,
        redFlagAcknowledged,
      }))(useOnboardingStore.getState());
      if (kind !== 'self') {
        await act(() => {
          useFamilyStore.getState().add({ id: 'other', kind });
        });
        await act(() => switchProfile('other', { birthMonth: 1, birthYear: 2011 }));
        await act(() => switchProfile(self.id));
      } else {
        await act(() => {
          useFamilyStore.getState().add({ id: 'other', kind: 'parent' });
        });
        await act(() => switchProfile('other', { birthMonth: 1, birthYear: 1950 }));
        await act(() => switchProfile(self.id));
      }
      const s = useOnboardingStore.getState();
      expect({
        painAreas: s.painAreas,
        conditions: s.conditions,
        position: s.position,
        redFlagAcknowledged: s.redFlagAcknowledged,
      }).toEqual(saved);
    },
  );
});

describe('R8-02 tampered birth date on a locked teen', () => {
  const lockTeen = () =>
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'teen',
      minors: { teen: 'teen' },
    });
  afterEach(() => useOwnerIdentityStore.setState({ ownerId: null, activeId: null, minors: {} }));

  it.each([
    ['2016', { birthMonth: 3, birthYear: 2016 }],
    ['2021', { birthMonth: 3, birthYear: 2021 }],
    ['null', { birthMonth: undefined, birthYear: undefined }],
    ['NaN', { birthMonth: 3, birthYear: Number.NaN }],
    ['month 13', { birthMonth: 13, birthYear: 2010 }],
    ['1990', { birthMonth: 3, birthYear: 1990 }],
  ])('%s stays in teen mode', (_label, birth) => {
    lockTeen();
    const d = derive(birth);
    expect(d).toMatchObject({ mode: 'teen', band: 'teen' });
    expect(d!.age).toBeGreaterThanOrEqual(13);
    expect(d!.age).toBeLessThanOrEqual(17);
    expect(modeOf(birth)).toBe('teen');
  });

  it('a real teen age is kept', () => {
    lockTeen();
    expect(derive({ birthMonth: 3, birthYear: 2011 })?.age).toBe(15);
  });

  it('an under-13 lock never leaves child mode', () => {
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'kid',
      minors: { kid: 'under13' },
    });
    for (const birthYear of [1990, 2010, 2024, undefined])
      expect(derive({ birthMonth: 3, birthYear })?.mode).toBe('child');
  });

  it('with no lock and no valid date the fallback is restrictive, never adult', () => {
    expect(derive({ birthMonth: undefined, birthYear: undefined })).toBeNull();
    expect(FALLBACK_MODE).not.toBe('adult');
    expect(modeOf({})).toBe(FALLBACK_MODE);
    // The owner with a real date is untouched.
    expect(modeOf({ birthMonth: 3, birthYear: 1990 })).toBe('adult');
  });
});

describe('R8-03 v1-upgraded phone, not yet proven', () => {
  it('the lock is found by the plain active id until the PIN is entered', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'sam', kind: 'child', createdAt: '' },
        ],
        activeId: 'sam',
      });
      // What seeding leaves on a v1 phone with a minor: no secure active id.
      useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: { sam: 'teen' } });
    });
    expect(activeMinorLock()).toBe('teen');
    expect(derive({ birthMonth: 3, birthYear: 1990 })).toMatchObject({ mode: 'teen', age: 17 });
  });

  it('a proven owner is not locked by a minor elsewhere on the phone', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'sam', kind: 'child', createdAt: '' },
        ],
        activeId: 'owner',
      });
      useOwnerIdentityStore.setState({
        ownerId: 'owner',
        activeId: 'owner',
        minors: { sam: 'teen' },
      });
    });
    expect(activeMinorLock()).toBeUndefined();
    expect(modeOf({ birthMonth: 3, birthYear: 1990 })).toBe('adult');
  });
});

describe('R8-05 PIN reset goes only to the owner', () => {
  // Imported here: the module under test reads the secure owner record.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reset = require('./pinReset') as typeof import('./pinReset');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const account = require('@/features/account/store') as typeof import('@/features/account/store');

  const client = (over: Record<string, unknown> = {}) => {
    const auth = {
      signInWithOtp: jest.fn(async () => ({ error: null })),
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'owner-user' } }, error: null })),
      getUser: jest.fn(async () => ({ data: { user: null } })),
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'a', refresh_token: 'r' } },
      })),
      signOut: jest.fn(async () => ({ error: null })),
      setSession: jest.fn(async () => ({ error: null })),
      ...over,
    };
    return { auth } as never as import('@supabase/supabase-js').SupabaseClient & {
      auth: typeof auth;
    };
  };

  beforeEach(() => {
    reset.resetCodeCooldown();
    useParentPinStore.getState().reset();
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: null,
      minors: {},
      ownerAuth: { email: 'dan@example.com', userId: 'owner-user' },
    });
    account.useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
  });

  it('an edited plain account email never receives the code', async () => {
    account.useAccountStore.getState().update({ email: 'teen@example.com' });
    const c = client();
    expect(await reset.sendPinResetCode(c)).toBe('sent');
    expect(c.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'dan@example.com',
      options: { shouldCreateUser: false },
    });
    expect(reset.ownerEmail()).toBe('dan@example.com');
  });

  it("a code that signs in another user fails and restores the phone's session", async () => {
    const c = client({
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'teen-user' } }, error: null })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('error');
    expect(c.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(c.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it("the owner's own code passes, and its session is signed out (Phase 21)", async () => {
    const c = client();
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
    expect(c.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(c.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('an older phone learns the owner from the signed-in account, not the plain email', async () => {
    useOwnerIdentityStore.setState({ ownerAuth: null });
    account.useAccountStore.getState().update({ email: 'teen@example.com' });
    const c = client({
      getUser: jest.fn(async () => ({
        data: { user: { id: 'owner-user', email: 'Dan@Example.com', is_anonymous: false } },
      })),
    });
    expect(await reset.sendPinResetCode(c)).toBe('sent');
    expect(c.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dan@example.com' }),
    );
    expect(useOwnerIdentityStore.getState().ownerAuth).toEqual({
      email: 'dan@example.com',
      userId: 'owner-user',
    });
  });

  it('no secure record and no signed-in owner: no code at all', async () => {
    useOwnerIdentityStore.setState({ ownerAuth: null });
    const c = client({
      getUser: jest.fn(async () => ({ data: { user: { id: 'anon', is_anonymous: true } } })),
    });
    expect(await reset.sendPinResetCode(c)).toBe('no_account');
    expect(c.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('saving the account records the owner in the secure store', async () => {
    useOwnerIdentityStore.setState({ ownerAuth: null });
    const c = client({ getUser: jest.fn(async () => ({ data: { user: { id: 'owner-user' } } })) });
    await reset.rememberOwnerAuth(c, 'dan@example.com');
    expect(useOwnerIdentityStore.getState().ownerAuth?.userId).toBe('owner-user');
  });
});

describe('R9-05 the code session always ends, and failures are never "ok"', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reset = require('./pinReset') as typeof import('./pinReset');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const account = require('@/features/account/store') as typeof import('@/features/account/store');
  const auth = (over: Record<string, unknown> = {}) =>
    ({
      auth: {
        verifyOtp: jest.fn(async () => ({ data: { user: { id: 'owner-user' } }, error: null })),
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'a', refresh_token: 'r' } },
        })),
        signOut: jest.fn(async () => ({ error: null })),
        setSession: jest.fn(async () => ({ error: null })),
        ...over,
      },
    }) as never as import('@supabase/supabase-js').SupabaseClient & {
      auth: Record<string, jest.Mock>;
    };

  beforeEach(() => {
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: null,
      minors: {},
      ownerAuth: { email: 'dan@example.com', userId: 'owner-user' },
    });
    account.useAccountStore.getState().update({ saved: true, needsSignIn: false });
    // No lockout left over from another test (random order).
    useParentPinStore.getState().reset();
    reset.resetCodeCooldown();
  });

  it('restore returns { error } (expired token): the owner still sets the PIN, then signs in again (R10-03)', async () => {
    const c = auth({ setSession: jest.fn(async () => ({ error: { status: 400 } })) });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok_signed_out');
    expect(account.useAccountStore.getState()).toMatchObject({ saved: false, needsSignIn: true });
  });

  it('restore throws (offline): the owner still sets the PIN', async () => {
    const c = auth({
      setSession: jest.fn(async () => {
        throw new Error('Network request failed');
      }),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok_signed_out');
  });

  it('no previous session: the verified owner session is kept, and the account is back (R10-03)', async () => {
    account.useAccountStore.getState().update({ saved: false, needsSignIn: true });
    const c = auth({ getSession: jest.fn(async () => ({ data: { session: null } })) });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
    expect(c.auth.signOut).not.toHaveBeenCalled();
    expect(account.useAccountStore.getState()).toMatchObject({ saved: true, needsSignIn: false });
  });

  it('no previous session and another user: signed out, error', async () => {
    const c = auth({
      getSession: jest.fn(async () => ({ data: { session: null } })),
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'teen-user' } }, error: null })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('error');
    expect(c.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(account.useAccountStore.getState().saved).toBe(true);
  });

  it('sign-out returns { error } twice: the previous session is still put back (R10 P2)', async () => {
    // supabase-js 2.117 removes the local session even when the call fails.
    const signOut = jest.fn(async () => ({ error: { status: 500 } }));
    const c = auth({ signOut });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(c.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('sign-out and restore both fail: "sign in again", never plain ok', async () => {
    const c = auth({
      signOut: jest.fn(async () => ({ error: { status: 500 } })),
      setSession: jest.fn(async () => ({ error: { status: 400 } })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok_signed_out');
    expect(account.useAccountStore.getState()).toMatchObject({ saved: false, needsSignIn: true });
  });

  it('sign-out throws once, then works: retried, ok', async () => {
    const signOut = jest
      .fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce({ error: null });
    const c = auth({ signOut });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('wrong user and sign-out fails: error, never ok, the phone session put back', async () => {
    const c = auth({
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'teen-user' } }, error: null })),
      signOut: jest.fn(async () => ({ error: { status: 500 } })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('error');
    expect(c.auth.setSession).toHaveBeenCalled();
  });

  it('wrong user and nothing can be restored: error, and "sign in again"', async () => {
    const c = auth({
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'teen-user' } }, error: null })),
      setSession: jest.fn(async () => ({ error: { status: 400 } })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('error');
    expect(account.useAccountStore.getState().needsSignIn).toBe(true);
  });
});

describe('R9 P2 code limits', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reset = require('./pinReset') as typeof import('./pinReset');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pin = require('./parentPin') as typeof import('./parentPin');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const codeLock = require('./resetCodeLock') as typeof import('./resetCodeLock');
  const client = (over: Record<string, unknown> = {}) =>
    ({
      auth: {
        signInWithOtp: jest.fn(async () => ({ error: null })),
        verifyOtp: jest.fn(async () => ({ data: {}, error: { code: 'otp_expired', status: 403 } })),
        getSession: jest.fn(async () => ({ data: { session: null } })),
        signOut: jest.fn(async () => ({ error: null })),
        setSession: jest.fn(async () => ({ error: null })),
        ...over,
      },
    }) as never as import('@supabase/supabase-js').SupabaseClient & {
      auth: Record<string, jest.Mock>;
    };
  beforeEach(() => {
    reset.resetCodeCooldown();
    pin.useParentPinStore.getState().reset();
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      ownerAuth: { email: 'dan@example.com', userId: 'owner-user' },
    });
  });

  it('20 taps send one code; another only after a minute', async () => {
    const c = client();
    const results = [];
    for (let n = 0; n < 20; n++) results.push(await reset.sendPinResetCode(c));
    expect(results[0]).toBe('sent');
    expect(results.slice(1).every((r) => r === 'wait')).toBe(true);
    expect(c.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    const now = clock.now;
    try {
      clock.now = () => new Date(now().getTime() + 61_000);
      expect(await reset.sendPinResetCode(c)).toBe('sent');
    } finally {
      clock.now = now;
    }
  });

  it('the one-a-minute limit is kept in the secure store, and a clock set back still waits', async () => {
    const c = client();
    expect(await reset.sendPinResetCode(c)).toBe('sent');
    expect(codeLock.useResetCodeStore.getState().lastCodeAt).not.toBeNull();
    const now = clock.now;
    try {
      clock.now = () => new Date(now().getTime() - 3_600_000);
      expect(await reset.sendPinResetCode(c)).toBe('wait');
      expect(codeLock.codeWaitSeconds()).toBe(60);
    } finally {
      clock.now = now;
    }
  });

  it('5 wrong codes lock the code for 15 minutes, never the PIN (R10 decision 1)', async () => {
    const c = client();
    const results = [];
    for (let n = 0; n < 6; n++) results.push(await reset.verifyPinResetCode(c, '111111'));
    expect(results.slice(0, 4)).toEqual(['wrong_code', 'wrong_code', 'wrong_code', 'wrong_code']);
    expect(results[4]).toBe('locked');
    expect(results[5]).toBe('locked');
    expect(codeLock.codeLockMinutesLeft()).toBe(15);
    expect(pin.lockMinutesLeft()).toBe(0);
    expect(pin.useParentPinStore.getState().failures).toBe(0);
  });

  it('5 wrong PINs never block the email code (R10 decision 1)', async () => {
    pin.setParentPin('1234');
    for (let n = 0; n < 5; n++) pin.checkParentPin('9999');
    expect(pin.lockMinutesLeft()).toBe(15);
    const c = client({
      getSession: jest.fn(async () => ({
        data: { session: { access_token: 'a', refresh_token: 'r' } },
      })),
      verifyOtp: jest.fn(async () => ({ data: { user: { id: 'owner-user' } }, error: null })),
    });
    expect(await reset.verifyPinResetCode(c, '123456')).toBe('ok');
  });

  it('wrong codes are reported to the server, and a server lock applies on the phone', async () => {
    const until = new Date(clock.now().getTime() + 10 * 60000).toISOString();
    const rpc = jest.fn(async (name: string) =>
      name === 'pin_reset_code_locked_until'
        ? { data: null, error: null }
        : { data: until, error: null },
    );
    const account = (
      jest.requireActual('@/features/account/store') as typeof import('@/features/account/store')
    ).useAccountStore;
    account.getState().update({ saved: true });
    const c = { ...client(), rpc } as never as Parameters<typeof reset.verifyPinResetCode>[0];
    expect(await reset.verifyPinResetCode(c, '111111')).toBe('wrong_code');
    expect(rpc).toHaveBeenCalledWith('pin_reset_code_failed');
    expect(rpc).not.toHaveBeenCalledWith('parent_pin_failed');
    expect(codeLock.codeLockMinutesLeft()).toBe(10);
    // Cleared app data: the lock comes back from the server before any try.
    codeLock.useResetCodeStore.getState().reset();
    const locked = jest.fn(async () => ({ data: until, error: null }));
    const c2 = { ...client(), rpc: locked } as never as Parameters<
      typeof reset.verifyPinResetCode
    >[0];
    expect(await reset.verifyPinResetCode(c2, '123456')).toBe('locked');
  });
});
