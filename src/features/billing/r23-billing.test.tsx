/**
 * QA round 10 P2, billing: the start plan follows a Family permission that
 * loads late; "Manage" on the Family plan opens Billing without a second
 * parent PIN; a minor's plan switch gets its own reason.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import BillingScreen from '@/app/billing';
import PlansScreen from '@/app/plans';
import i18n from '@/i18n';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { setParentPin, useParentPinStore } from '@/features/family/parentPin';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { PRODUCTS } from './rules';
import { useBillingStore } from './store';
import { usePlanChoice } from './useFamilyPlan';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

describe('start plan', () => {
  it('Family allowed only after the lock loads: the Family link lands on Family', async () => {
    const { result, rerender } = await renderHook(
      ({ ok }: { ok: boolean }) => usePlanChoice('free', 'family', ok),
      { initialProps: { ok: false } },
    );
    expect(result.current[0]).toBe('premium');
    await rerender({ ok: true });
    expect(result.current[0]).toBe('family');
  });

  it("the person's own pick is kept; a Family pick no longer allowed falls back", async () => {
    const { result, rerender } = await renderHook(
      ({ ok }: { ok: boolean }) => usePlanChoice('free', undefined, ok),
      { initialProps: { ok: true } },
    );
    await act(() => result.current[1]('family'));
    expect(result.current[0]).toBe('family');
    await rerender({ ok: false });
    expect(result.current[0]).toBe('premium');
    await act(() => result.current[1]('free'));
    await rerender({ ok: true });
    expect(result.current[0]).toBe('free');
  });
});

describe('Family plan, teen profile active', () => {
  beforeEach(async () => {
    clock.now = () => new Date('2026-09-29T12:00:00Z');
    await act(() => {
      useParentPinStore.getState().reset();
      setParentPin('2468');
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
      });
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 2011, onboardingComplete: true });
      useBillingStore.setState({
        entitlement: {
          ...useBillingStore.getState().entitlement,
          plan: 'family',
          status: 'active',
          expiresAt: '2027-01-01T00:00:00Z',
          productId: PRODUCTS.family.monthly,
        },
      });
    });
  });

  it('PIN once on Plans, then "Manage" opens Billing without asking again', async () => {
    await render(<PlansScreen />);
    await fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Manage my subscription' }));
    await render(<BillingScreen />);
    expect(screen.queryByText('Enter the parent PIN.')).toBeNull();
    // The pass is used once: opening Billing again asks the PIN.
    await render(<BillingScreen />);
    expect(screen.getByText('Enter the parent PIN.')).toBeTruthy();
  });

  it('Billing opened any other way still asks the PIN', async () => {
    await render(<BillingScreen />);
    expect(screen.getByText('Enter the parent PIN.')).toBeTruthy();
  });

  it('a plan switch from the minor profile says who can change it', () => {
    expect(i18n.t('billing.errors.family_owner_only')).toBe(
      'Only the account owner can change the Family plan, from their own profile.',
    );
  });
});
