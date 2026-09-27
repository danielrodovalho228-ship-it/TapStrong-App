/**
 * QA round 2 — P1 safety and family (docs/qa-round-2.md §2: R2-03, R2-04,
 * R2-05, R2-12).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddMemberScreen from '@/app/family/add';
import PaywallScreen from '@/app/paywall';
import { useAccountStore } from '@/features/account/store';
import { PRODUCTS } from '@/features/billing/rules';
import { FREE, useBillingStore } from '@/features/billing/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { FamilyStrip } from './components/FamilyStrip';
import { ParentGate } from './ParentGate';
import {
  checkParentPin,
  LOCK_MINUTES,
  lockMinutesLeft,
  setParentPin,
  useParentPinStore,
} from './parentPin';
import { childConsentBlocker } from './rules';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null, ensureSession: async () => true }));

const NOW = new Date('2026-09-27T12:00:00Z');
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
  clock.now = () => NOW;
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1983, sex: 'f' });
    useFamilyStore.getState().reset();
    useBillingStore.getState().reset();
    useAccountStore.getState().reset();
    useParentPinStore.getState().reset();
  });
});

const withChildActive = () =>
  useFamilyStore.setState({
    profiles: [
      { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
      { id: 'c1', kind: 'child', name: 'Mia', createdAt: '2026-09-02T00:00:00Z', consentAt: 'x' },
    ],
    activeId: 'c1',
  });

describe('R2-03 a child cannot change the plan from the paywall', () => {
  it('the paywall asks for the parent PIN on a child profile', async () => {
    await act(() => {
      setParentPin('2468');
      withChildActive();
    });
    await render(<PaywallScreen />);
    expect(screen.getByLabelText('Parent PIN')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Premium/ })).toBeNull();
  });

  it('a subscriber is not told they are on the free plan', async () => {
    await act(() => useBillingStore.getState().set({ entitlement: charged, hadTrial: true }));
    await render(<PaywallScreen />);
    expect(screen.queryByText(/Free plan/)).toBeNull();
    expect(screen.getByText('Your plan · Family')).toBeTruthy();
  });
});

describe('R2-04 only an adult gives parental consent', () => {
  const base = {
    id: '6f1c2b1e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
    birth: { year: 2016, month: 5 },
    profiles: [],
    entitlement: charged,
    now: NOW,
    today: { year: 2026, month: 9 },
  };

  it('the consent check refuses an owner under 18 or of unknown age', () => {
    expect(childConsentBlocker({ ...base, ownerAge: 17 })).toBe('owner_minor');
    expect(childConsentBlocker({ ...base, ownerAge: null })).toBe('owner_minor');
    expect(childConsentBlocker({ ...base, ownerAge: 43 })).toBeNull();
    // Under the minimum age of 9, not "only for children under 13".
    expect(childConsentBlocker({ ...base, ownerAge: 43, birth: { year: 2020, month: 5 } })).toBe(
      'too_young',
    );
  });

  it('a 17-year-old owner cannot add family members', async () => {
    await act(() => {
      useOnboardingStore.getState().update({ birthYear: 2009 });
      useBillingStore.getState().set({ entitlement: charged });
    });
    await render(<AddMemberScreen />);
    expect(
      screen.getByText('Only an adult (18+) can manage family profiles and give parental consent.'),
    ).toBeTruthy();
  });
});

describe('R2-05 parent PIN with a lockout', () => {
  it('locks for 15 minutes after 5 wrong tries', () => {
    setParentPin('2468');
    for (let i = 0; i < 4; i++) expect(checkParentPin('1111', NOW)).toBe('wrong');
    expect(checkParentPin('1111', NOW)).toBe('locked');
    // Even the right PIN waits out the lockout.
    expect(checkParentPin('2468', NOW)).toBe('locked');
    expect(lockMinutesLeft(NOW)).toBe(LOCK_MINUTES);
    const later = new Date(NOW.getTime() + LOCK_MINUTES * 60000 + 1000);
    expect(checkParentPin('2468', later)).toBe('ok');
  });

  it('never stores the PIN itself', () => {
    setParentPin('2468');
    expect(JSON.stringify(useParentPinStore.getState())).not.toContain('2468');
  });

  it('a child profile without a PIN is told to ask a parent (no way to create one)', async () => {
    await act(withChildActive);
    await render(<ParentGate onPass={jest.fn()} />);
    expect(screen.getByText(/A parent needs to create a parent PIN first/)).toBeTruthy();
    expect(screen.queryByLabelText('New PIN')).toBeNull();
  });

  it('the owner creates the PIN, then the gate asks for it', async () => {
    const onPass = jest.fn();
    await render(<ParentGate onPass={onPass} />);
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '2468');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(onPass).toHaveBeenCalled();
    expect(checkParentPin('2468', NOW)).toBe('ok');
  });
});

describe('R2-12 FamilyStrip never writes to a store during render', () => {
  it('registers the owner in an effect', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(<FamilyStrip />);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/);
    expect(useFamilyStore.getState().profiles.some((p) => p.kind === 'self')).toBe(true);
    error.mockRestore();
  });
});
