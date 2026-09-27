/**
 * QA round 3 (P2) — family and payments: no Family purchase for an owner
 * under 18 (approved by Daniel), no kids copy or consent notice with kids
 * under 13 off, failed member removals retried, no measurements for teens.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FamilyTab from '@/app/(tabs)/family';
import ConsentScreen from '@/app/family/consent';
import PlansScreen from '@/app/plans';
import { useAccountStore } from '@/features/account/store';
import { buy } from '@/features/billing/actions';
import { familyPurchaseBlocked, PRODUCTS } from '@/features/billing/rules';
import { FREE, useBillingStore } from '@/features/billing/store';
import { whoErrorKey } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { setKidsUnder13Enabled } from '@/lib/features';

import { deleteOrQueue, retryPendingDeletes, usePendingDeletesStore } from './remote';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({
    id: '6f1c2b1e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
    month: '5',
    year: '2016',
  }),
  Redirect: () => null,
}));
const mockPurchase = jest.fn(async (_id: string) => 'ok' as const);
jest.mock('@/features/billing/provider', () => ({
  getBilling: () => ({
    kind: 'revenuecat',
    purchase: mockPurchase,
    entitlement: async () => jest.requireActual('@/features/billing/store').FREE,
    prices: async () => ({}),
    identify: async () => undefined,
  }),
  setBilling: () => undefined,
}));
let mockDelete: () => Promise<{ error: unknown; status: number }> = async () => ({
  error: null,
  status: 204,
});
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({ delete: () => ({ eq: () => mockDelete() }) }),
  }),
  ensureSession: async () => true,
}));

beforeAll(() => {
  clock.now = () => new Date('2026-09-27T12:00:00Z');
});

async function owner(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore
      .getState()
      .update({ birthMonth: 3, birthYear, who: 'me', onboardingComplete: true });
    useFamilyStore.getState().reset();
    useBillingStore.getState().reset();
    useAccountStore.getState().reset();
    useAccountStore.getState().update({ saved: true, email: 'o@example.com' });
  });
}

beforeEach(() => {
  mockPurchase.mockClear();
  setKidsUnder13Enabled(false);
  usePendingDeletesStore.setState({ ids: [] });
});
afterAll(() => setKidsUnder13Enabled(true));

describe('Family plan: adults only', () => {
  it('the rule: 18 and over', () => {
    expect(familyPurchaseBlocked(17)).toBe(true);
    expect(familyPurchaseBlocked(18)).toBe(false);
    expect(familyPurchaseBlocked(null)).toBe(false);
  });

  it('a 17-year-old owner sees "adults only" and no purchase button for Family', async () => {
    await owner(2009);
    await render(<PlansScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^Family/ }));
    expect(screen.getByText(/The Family plan is for adults 18 and over/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /free trial|Subscribe/ })).toBeNull();
    // Premium stays available.
    await fireEvent.press(screen.getByRole('radio', { name: /^Premium/ }));
    expect(screen.getByRole('button', { name: /free trial|Subscribe/ })).toBeTruthy();
  });

  it('the purchase itself is refused for a Family product, never sent to the store', async () => {
    await owner(2009);
    expect(await buy(PRODUCTS.family.monthly)).toBe('adults_only');
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(await buy(PRODUCTS.premium.monthly)).toBe('ok');
    expect(mockPurchase).toHaveBeenCalledWith(PRODUCTS.premium.monthly);
  });

  it('an adult owner can buy Family', async () => {
    await owner(1983);
    expect(await buy(PRODUCTS.family.annual)).toBe('ok');
  });
});

describe('kids under 13 off: no kids copy, no consent notice', () => {
  it('plans speak of teens, not kids', async () => {
    await owner(1983);
    await render(<PlansScreen />);
    expect(screen.queryByText(/kids/i)).toBeNull();
    expect(screen.getByText(/parent-managed teens/)).toBeTruthy();
  });

  it('a deep link to the consent notice gets a short "not available"', async () => {
    await owner(1983);
    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'family',
          status: 'active',
          firstChargedAt: '2026-09-01T00:00:00Z',
        },
      }),
    );
    await render(<ConsentScreen />);
    expect(screen.getByRole('header', { name: 'Not available yet' })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('the teen lock message does not mention children under 13', () => {
    expect(whoErrorKey('teen_locked')).toBe('who.errors.teen_lockedTeens');
    setKidsUnder13Enabled(true);
    expect(whoErrorKey('teen_locked')).toBe('who.errors.teen_locked');
  });
});

describe('remove member: a failed cloud delete is retried', () => {
  it('queues an offline delete and finishes it later', async () => {
    mockDelete = async () => ({
      error: { message: 'TypeError: Network request failed' },
      status: 0,
    });
    expect(await deleteOrQueue('p1')).toBe('queued');
    expect(usePendingDeletesStore.getState().ids).toEqual(['p1']);
    expect(await retryPendingDeletes()).toBe(1);
    mockDelete = async () => ({ error: null, status: 204 });
    expect(await retryPendingDeletes()).toBe(0);
    expect(usePendingDeletesStore.getState().ids).toEqual([]);
  });

  it('the Family tab tells the owner', async () => {
    await owner(1983);
    usePendingDeletesStore.setState({ ids: ['p1'] });
    mockDelete = async () => ({ error: { message: 'Failed to fetch' }, status: 0 });
    await render(<FamilyTab />);
    expect(screen.getByText(/still in your account/)).toBeTruthy();
  });
});
