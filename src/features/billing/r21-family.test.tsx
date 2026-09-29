/**
 * Phase 21 (Daniel): the Family plan is for adults. No Family card or offer
 * while a minor's profile is active, and a minor on the Family link gets
 * "An adult needs to subscribe to the Family plan. with no purchase.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PaywallScreen from '@/app/paywall';
import PlansScreen from '@/app/plans';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { buy, familyPlanAllowed } from './actions';
import { useBillingStore } from './store';
import * as provider from './provider';
import { PRODUCTS } from './rules';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
// The parent PIN is tested elsewhere; here the owner has passed it.
jest.mock('@/features/family/OwnerOnly', () => ({
  ...jest.requireActual('@/features/family/OwnerOnly'),
  OwnerOnly: ({ children }: { children: React.ReactNode }) => children,
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T12:00:00Z');
});

async function solo(birthYear: number) {
  await act(() => {
    useBillingStore.getState().reset();
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear, onboardingComplete: true });
  });
}

async function ownerWithTeen(active: 'owner' | 'teen') {
  await act(() => {
    useBillingStore.getState().reset();
    useFamilyStore.setState({
      profiles: [
        { id: 'owner', kind: 'self', createdAt: '' },
        { id: 'teen', kind: 'child', createdAt: '' },
      ],
      activeId: active,
    });
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: active,
      minors: { teen: 'teen' },
    });
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: active === 'teen' ? 2011 : 1985,
      onboardingComplete: true,
    });
  });
}

const familyCard = () => screen.queryByRole('radio', { name: /Family/ });

describe('Family plan card', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('an adult sees it', async () => {
    await solo(1985);
    expect(familyPlanAllowed()).toBe(true);
    await render(<PlansScreen />);
    expect(familyCard()).toBeTruthy();
  });

  it('a solo 17-year-old does not', async () => {
    await solo(2009);
    expect(familyPlanAllowed()).toBe(false);
    await render(<PlansScreen />);
    expect(familyCard()).toBeNull();
    expect(screen.getByRole('radio', { name: /Premium/ })).toBeTruthy();
  });

  it('a locked teen (even with an adult year stored) does not', async () => {
    await ownerWithTeen('teen');
    await act(() => useOnboardingStore.setState({ birthYear: 1990 }));
    expect(familyPlanAllowed()).toBe(false);
  });

  it('the owner sees it, but not while the teen is active', async () => {
    await ownerWithTeen('owner');
    expect(familyPlanAllowed()).toBe(true);
    await ownerWithTeen('teen');
    expect(familyPlanAllowed()).toBe(false);
  });

  it('the paywall lists no Family value or card for a minor', async () => {
    await solo(2009);
    await render(<PaywallScreen />);
    expect(familyCard()).toBeNull();
  });
});

describe('Family link opened by a minor', () => {
  it('says an adult must buy it, starts no purchase, and goes back', async () => {
    await solo(2009);
    mockParams = { plan: 'family' };
    const purchase = jest.spyOn(provider.getBilling(), 'purchase');
    await render(<PlansScreen />);
    expect(screen.getByText('An adult needs to subscribe to the Family plan.')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    expect(router.back).toHaveBeenCalled();
    expect(await buy(PRODUCTS.family.monthly)).toBe('adults_only');
    expect(purchase).not.toHaveBeenCalled();
  });

  it('an adult on the link gets the Family plan selected', async () => {
    await solo(1985);
    mockParams = { plan: 'family' };
    await render(<PlansScreen />);
    expect(familyCard()).toBeChecked();
  });
});

describe('R9-04 Family subscriber with the teen profile active', () => {
  const familyOn = async () => {
    const { useBillingStore } = jest.requireActual('./store') as typeof import('./store');
    await act(() =>
      useBillingStore.setState({
        entitlement: {
          ...useBillingStore.getState().entitlement,
          plan: 'family',
          status: 'active',
          expiresAt: '2027-01-01T00:00:00Z',
          productId: PRODUCTS.family.monthly,
        },
      }),
    );
  };

  it('Plans shows "You\'re on the Family plan" + Manage, no picker, no buy button', async () => {
    await ownerWithTeen('teen');
    await familyOn();
    mockParams = {};
    await render(<PlansScreen />);
    expect(screen.getByText(/You're on the Family plan/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Premium/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch to|free trial|Subscribe/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Manage my subscription' }));
    expect(router.push).toHaveBeenCalledWith('/billing');
  });

  it('buy() refuses a Premium switch from the teen profile', async () => {
    await ownerWithTeen('teen');
    await familyOn();
    const purchase = jest.spyOn(provider.getBilling(), 'purchase');
    expect(await buy(PRODUCTS.premium.monthly)).toBe('adults_only');
    expect(purchase).not.toHaveBeenCalled();
  });

  it('the owner on their own profile still sees the picker', async () => {
    await ownerWithTeen('owner');
    await familyOn();
    await render(<PlansScreen />);
    expect(screen.getByRole('radio', { name: /Family/ })).toBeTruthy();
  });
});
