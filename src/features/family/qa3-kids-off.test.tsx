/**
 * Phase 12 — kids under 13 are off for launch (KIDS_UNDER_13_ENABLED=false).
 * Launch behaviour with the switch off; the same checks with it on show the
 * kept flow still works.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddMemberScreen from '@/app/family/add';
import WhoScreen from '@/app/onboarding/who';
import Welcome from '@/app/welcome';
import { PRODUCTS } from '@/features/billing/rules';
import { FREE, useBillingStore } from '@/features/billing/store';
import { allowedBands } from '@/features/bodymap/selection';
import { useAgeBlockStore } from '@/features/onboarding/ageBlock';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import { bandForAge, birthYearOptions } from '@/features/profile/age';
import { clock } from '@/lib/clock';
import { kidsUnder13Enabled, setKidsUnder13Enabled } from '@/lib/features';

import { childConsentBlocker } from './rules';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null, ensureSession: async () => true }));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const today = { year: 2026, month: 9 };
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
  setKidsUnder13Enabled(false);
  await act(() => {
    useOnboardingStore.getState().reset();
    useFamilyStore.getState().reset();
    useBillingStore.getState().reset();
    useAgeBlockStore.getState().reset();
  });
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

afterAll(() => setKidsUnder13Enabled(true));

describe('kids under 13 off (launch default)', () => {
  it('the app default is off unless the env switch turns it on', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/lib/features') as typeof import('@/lib/features');
      expect(fresh.kidsUnder13Enabled()).toBe(false);
      expect(fresh.minAge()).toBe(13);
    });
    expect(kidsUnder13Enabled()).toBe(false);
  });

  it('age gate: 13 and up; a parent cannot add a child under 13; teens are fine', () => {
    expect(evaluateAgeGate('me', { year: 2016, month: 5 }, today).status).toBe('under_min');
    expect(evaluateAgeGate('child', { year: 2016, month: 5 }, today).status).toBe(
      'child_unavailable',
    );
    expect(evaluateAgeGate('child', { year: 2012, month: 5 }, today)).toMatchObject({
      status: 'ok',
      mode: 'teen',
    });
    expect(evaluateAgeGate('me', { year: 2012, month: 5 }, today).status).toBe('ok');
    expect(bandForAge(10)).toBeNull();
  });

  it('the year list stays neutral: it does not stop at 13', () => {
    expect(birthYearOptions(today)[0]).toBeGreaterThan(today.year - 13);
  });

  it('neutral stop: no live hint, then "13 and up" that going back cannot undo', async () => {
    await act(() => useOnboardingStore.getState().update({ birthMonth: 5, birthYear: 2016 }));
    await render(<WhoScreen />);
    expect(screen.queryByText(/13 and up/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('header', { name: 'TapStrong is for ages 13 and up' })).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
    // A new birth date on the same phone does not unlock it.
    await act(() => useOnboardingStore.getState().update({ birthYear: 1990 }));
    await render(<WhoScreen />);
    expect(screen.getByRole('header', { name: 'TapStrong is for ages 13 and up' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Birth year:/ })).toBeNull();
    expect(useAgeBlockStore.getState().birth).toEqual({ year: 2016, month: 5 });
  });

  it('"My child" becomes "My teen (13–17)"', async () => {
    await render(<WhoScreen />);
    expect(screen.getByRole('radio', { name: 'My teen (13–17)' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'My child (under 18)' })).toBeNull();
  });

  it('Family: a child under 13 is refused, no consent flow; a teen can be added', async () => {
    await act(() => useBillingStore.getState().set({ entitlement: charged }));
    await act(() =>
      useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1983, who: 'me' }),
    );
    await render(<AddMemberScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Mia');
    const pick = async (month: string, year: string) => {
      await fireEvent.press(screen.getByRole('button', { name: /^Birth month:/ }));
      await fireEvent.press(screen.getByRole('button', { name: month }));
      await fireEvent.press(screen.getByRole('button', { name: /^Birth year:/ }));
      await fireEvent.press(screen.getByRole('button', { name: year }));
    };
    await pick('May', '2016');
    expect(screen.getByText(/aren’t available yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next: parent consent' })).toBeNull();
    await pick('May', '2012');
    expect(screen.queryByText(/aren’t available yet/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeEnabled();
  });

  it('the consent check is closed and no child body models are offered', () => {
    expect(
      childConsentBlocker({
        id: '6f1c2b1e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
        birth: { year: 2016, month: 5 },
        profiles: [],
        entitlement: charged,
        now: new Date('2026-09-26T12:00:00Z'),
        today,
        ownerAge: 43,
      }),
    ).toBe('disabled');
    expect(allowedBands('teen')).toEqual(['teen']);
  });

  it('Welcome shows "Teens 13+", never "Kids 9+"', async () => {
    await render(<Welcome />);
    expect(screen.getByText('Teens 13+')).toBeTruthy();
    expect(screen.queryByText('Kids 9+')).toBeNull();
  });
});

describe('the kept flow with the switch on', () => {
  beforeEach(() => setKidsUnder13Enabled(true));

  it('under 13 goes back to the parent / consent rules', () => {
    expect(evaluateAgeGate('me', { year: 2016, month: 5 }, today).status).toBe('ask_parent');
    expect(evaluateAgeGate('child', { year: 2016, month: 5 }, today).status).toBe(
      'guardian_consent',
    );
    expect(allowedBands('teen')).toEqual(['kid', 'teen']);
  });
});
