/**
 * Phase 12 — the owner's own profile is saved to the cloud before a family
 * profile is created, with a clear message when offline.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddMemberScreen from '@/app/family/add';
import { ensureOwnerProfileSynced } from '@/features/account/cloud';
import { useAccountStore } from '@/features/account/store';
import { PRODUCTS } from '@/features/billing/rules';
import { FREE, useBillingStore } from '@/features/billing/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { setParentPin, useParentPinStore } from './parentPin';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
// A store build (not the development purchase simulator): the cloud matters.
jest.mock('@/features/billing/provider', () => ({
  getBilling: () => ({ kind: 'revenuecat', identify: async () => undefined }),
  setBilling: () => undefined,
}));
let mockOnline = true;
const mockUpsert = jest.fn(async (_row: Record<string, unknown>) => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () =>
    mockOnline
      ? {
          auth: {
            getUser: async () => ({ data: { user: { id: 'u1', is_anonymous: false } } }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
            upsert: mockUpsert,
          }),
        }
      : null,
  ensureSession: async () => true,
}));

const charged = {
  ...FREE,
  plan: 'family' as const,
  status: 'active' as const,
  productId: PRODUCTS.family.monthly,
  expiresAt: '2026-10-27T12:00:00Z',
  willRenew: true,
  firstChargedAt: '2026-09-01T00:00:00Z',
};

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

beforeEach(async () => {
  mockOnline = true;
  mockUpsert.mockClear();
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1983, sex: 'f', who: 'me' });
    useFamilyStore.getState().reset();
    useAccountStore.getState().reset();
    useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
    useBillingStore.getState().set({ entitlement: charged });
    useParentPinStore.getState().reset();
    setParentPin('2468');
  });
});

async function addTeen() {
  await render(<AddMemberScreen />);
  await fireEvent.changeText(screen.getByLabelText('First name'), 'Leo');
  await fireEvent.press(screen.getByRole('button', { name: /^Birth month:/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'May' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Birth year:/ }));
  await fireEvent.press(screen.getByRole('button', { name: '2012' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create profile' }));
}

describe('owner profile first', () => {
  it('saves the owner row (with the birth date the database checks) before adding', async () => {
    await addTeen();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', birth_year: 1983, birth_month: 3, mode: 'adult' }),
    );
    expect(useFamilyStore.getState().profiles.some((p) => p.name === 'Leo')).toBe(true);
  });

  it('offline: a clear message and nothing is created', async () => {
    mockOnline = false;
    await addTeen();
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
    expect(useFamilyStore.getState().profiles.some((p) => p.name === 'Leo')).toBe(false);
  });

  it('needs a saved account and a finished owner profile', async () => {
    await act(() => useAccountStore.getState().update({ saved: false }));
    expect(await ensureOwnerProfileSynced()).toBe('no_account');
    await act(() => {
      useAccountStore.getState().update({ saved: true });
      useOnboardingStore.getState().reset();
    });
    expect(await ensureOwnerProfileSynced()).toBe('no_profile');
  });
});
