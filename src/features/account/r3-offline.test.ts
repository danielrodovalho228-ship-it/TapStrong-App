/**
 * QA R3-02 — supabase-js returns network failures as error objects, so the
 * offline copy must come from the error itself, not only from a throw.
 */
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { setParentPin, useParentPinStore } from '@/features/family/parentPin';
import { sendPinResetCode, verifyPinResetCode } from '@/features/family/pinReset';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { isNetworkError } from '@/lib/network';

import { ensureOwnerProfileSynced } from './cloud';
import { useAccountStore } from './store';

jest.mock('@/features/billing/provider', () => ({
  getBilling: () => ({ kind: 'revenuecat', identify: async () => undefined }),
  setBilling: () => undefined,
}));

const authOffline = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };
const dbOffline = { message: 'TypeError: Network request failed', details: '', hint: '', code: '' };

type Fake = {
  getUser?: () => Promise<unknown>;
  read?: () => Promise<unknown>;
  upsert?: () => Promise<unknown>;
  signInWithOtp?: () => Promise<unknown>;
  verifyOtp?: () => Promise<unknown>;
};
let mockFake: Fake = {};
function mockClient() {
  return {
    auth: {
      getUser:
        mockFake.getUser ?? (async () => ({ data: { user: { id: 'u1', is_anonymous: false } } })),
      signInWithOtp: mockFake.signInWithOtp ?? (async () => ({ error: null })),
      verifyOtp: mockFake.verifyOtp ?? (async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockFake.read ?? (async () => ({ data: null, error: null, status: 200 })),
        }),
      }),
      upsert: mockFake.upsert ?? (async () => ({ error: null, status: 201 })),
    }),
  };
}
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => mockClient(),
  ensureSession: async () => true,
}));

beforeEach(() => {
  mockFake = {};
  useOnboardingStore.getState().reset();
  useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1983, sex: 'f', who: 'me' });
  useFamilyStore.getState().reset();
  useAccountStore.getState().reset();
  useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
  useOwnerIdentityStore.getState().setOwnerAuth({ email: 'dan@example.com', userId: 'u1' });
  useParentPinStore.getState().reset();
  setParentPin('2468');
});

describe('isNetworkError', () => {
  it('knows a dropped connection from a server answer', () => {
    expect(isNetworkError(authOffline)).toBe(true);
    expect(isNetworkError(dbOffline, 0)).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError({ code: '42501', message: 'permission denied' }, 403)).toBe(false);
    expect(isNetworkError({ code: 'otp_expired', status: 403 })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('owner sync offline', () => {
  it('a saved account with no connection hears "offline", not "save your account"', async () => {
    mockFake.getUser = async () => ({ data: { user: null }, error: authOffline });
    expect(await ensureOwnerProfileSynced()).toBe('offline');
  });

  it('a read or write that fails on the network is offline too', async () => {
    mockFake.read = async () => ({ data: null, error: dbOffline, status: 0 });
    expect(await ensureOwnerProfileSynced()).toBe('offline');
    mockFake.read = undefined;
    mockFake.upsert = async () => ({ error: dbOffline, status: 0 });
    expect(await ensureOwnerProfileSynced()).toBe('offline');
  });

  it('a real server refusal is still an error', async () => {
    mockFake.upsert = async () => ({ error: { code: '42501', message: 'denied' }, status: 403 });
    expect(await ensureOwnerProfileSynced()).toBe('error');
  });

  it('signed out (no network problem) still asks to save the account', async () => {
    mockFake.getUser = async () => ({ data: { user: null }, error: null });
    expect(await ensureOwnerProfileSynced()).toBe('no_account');
  });
});

describe('PIN reset offline', () => {
  it('send and verify say offline on a network error', async () => {
    mockFake.signInWithOtp = async () => ({ error: authOffline });
    expect(await sendPinResetCode(mockClient() as never)).toBe('offline');
    mockFake.verifyOtp = async () => ({ error: authOffline });
    expect(await verifyPinResetCode(mockClient() as never, '123456')).toBe('offline');
  });

  it('a wrong code is still a wrong code', async () => {
    mockFake.verifyOtp = async () => ({ error: { code: 'otp_expired', status: 403 } });
    expect(await verifyPinResetCode(mockClient() as never, '123456')).toBe('wrong_code');
  });
});
