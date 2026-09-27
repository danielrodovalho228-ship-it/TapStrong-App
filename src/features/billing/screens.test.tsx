import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import BillingScreen from '@/app/billing';
import DeleteAccountScreen from '@/app/delete-account';
import AddMemberScreen from '@/app/family/add';
import ParentConsentScreen from '@/app/family/consent';
import PaywallScreen from '@/app/paywall';
import PlansScreen from '@/app/plans';
import WorkoutScreen from '@/app/workout/[id]/index';
import { useAccountStore } from '@/features/account/store';
import { devLibrary } from '@/features/exercises/library';
import { useParentPinStore } from '@/features/family/parentPin';
import { useFamilyStore } from '@/features/family/store';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { setBilling } from './provider';
import { PRODUCTS } from './rules';
import { FREE, useBillingStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/features/notifications/apply', () => ({
  requestPermission: async () => true,
  applyPlan: async () => undefined,
}));
const mockInvoke = jest.fn(async () => ({ data: { ok: true }, error: null }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: mockInvoke },
    auth: { signOut: async () => ({}), getUser: async () => ({ data: { user: null } }) },
    rpc: async () => ({ error: null }),
  }),
  ensureSession: async () => true,
}));

const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;
const events: string[] = [];
setAnalyticsSink((event) => events.push(event));

beforeAll(() => {
  // Saturday: the week (Sunday start) already has room for a few workouts.
  clock.now = () => new Date(2026, 8, 26, 12);
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'm',
      mainGoals: ['look'],
      minutes: 40,
      muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useBillingStore.getState().reset();
    useAccountStore.getState().reset();
    useFamilyStore.getState().reset();
  });
  setBilling(null); // development simulator
  mockParams = {};
  events.length = 0;
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
  mockInvoke.mockClear();
});

function startedWorkout(dayOfMonth: number) {
  const input = inputFromProfile(useOnboardingStore.getState(), devLibrary(), true)!;
  const id = useWorkoutStore.getState().create(generateSession(input));
  useWorkoutStore.setState({
    workouts: useWorkoutStore
      .getState()
      .workouts.map((w) =>
        w.id === id
          ? { ...w, status: 'done', startedAt: new Date(2026, 8, dayOfMonth, 9).toISOString() }
          : w,
      ),
  });
}

describe('Free plan limit', () => {
  it('sends the 4th workout of the week to the paywall', async () => {
    await act(() => {
      startedWorkout(21);
      startedWorkout(23);
      startedWorkout(25);
    });
    const input = inputFromProfile(useOnboardingStore.getState(), devLibrary(), true)!;
    const id = useWorkoutStore.getState().create(generateSession(input));
    mockParams = { id };
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start with warm-up' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { next: '2026-09-27' },
    });
    expect(useWorkoutStore.getState().workouts.find((w) => w.id === id)!.status).toBe('planned');
  });

  it('Premium starts it', async () => {
    await act(() => {
      startedWorkout(21);
      startedWorkout(23);
      startedWorkout(25);
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'premium',
          status: 'active',
          expiresAt: '2026-12-01T00:00:00Z',
        },
      });
    });
    const input = inputFromProfile(useOnboardingStore.getState(), devLibrary(), true)!;
    const id = useWorkoutStore.getState().create(generateSession(input));
    mockParams = { id };
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start with warm-up' }));
    expect(useWorkoutStore.getState().workouts.find((w) => w.id === id)!.status).toBe('active');
  });
});

describe('Paywall', () => {
  it('shows value first, then price with honest terms and cancel info', async () => {
    mockParams = { next: '2026-09-27' };
    await render(<PaywallScreen />);
    expect(events).toContain('paywall_viewed');
    expect(screen.getByText('Keep your streak going')).toBeTruthy();
    expect(screen.getByText(/next free workout is on Sunday/)).toBeTruthy();
    expect(screen.getByText(/Auto-renews at \$9\.99 \/ month after the 7-day trial/)).toBeTruthy();
    expect(screen.getByText(/We remind you 3 days before/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel anytime in 2 taps' })).toBeTruthy();
    // Subscribing needs a saved account first.
    await fireEvent.press(screen.getByRole('button', { name: 'Save your account to subscribe' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/account');
  });
});

describe('Plans (mockup 19)', () => {
  it('starts the Family trial (simulated) once the account is saved', async () => {
    await act(() => useAccountStore.getState().update({ saved: true }));
    await render(<PlansScreen />);
    // Premium is preselected (QA round 1); the buyer picks Family.
    expect(screen.getByRole('radio', { name: 'Premium, $9.99' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Family, $14.99' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Yearly' }));
    expect(screen.getByRole('radio', { name: 'Family, $89.99' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start 7-day free trial' }));
    expect(useBillingStore.getState().entitlement).toMatchObject({
      plan: 'family',
      status: 'trial',
      productId: PRODUCTS.family.annual,
    });
    expect(events).toContain('trial_started');
    expect(mockRouter.replace).toHaveBeenCalledWith('/billing');
  });
});

describe('Billing (mockup 22)', () => {
  it('shows trial end and first charge, and cancel opens the store', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          plan: 'family',
          status: 'trial',
          productId: PRODUCTS.family.monthly,
          trialEndsAt: '2026-10-02T12:00:00Z',
          expiresAt: '2026-10-02T12:00:00Z',
          willRenew: true,
          firstChargedAt: null,
        },
      }),
    );
    await render(<BillingScreen />);
    expect(screen.getByText('Family · 5 profiles')).toBeTruthy();
    expect(screen.getByText('Oct 2')).toBeTruthy();
    expect(screen.getByText('$14.99 on Oct 2')).toBeTruthy();
    expect(screen.getByText(/We notify you 3 days before/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('subscriptions'));
    expect(screen.getByText(/you keep Family until Oct 2/)).toBeTruthy();
  });
});

describe('Family members', () => {
  const pick = async (month: string, year: string) => {
    await fireEvent.press(screen.getByRole('button', { name: /^Birth month:/ }));
    await fireEvent.press(screen.getByRole('button', { name: month }));
    await fireEvent.press(screen.getByRole('button', { name: /^Birth year:/ }));
    await fireEvent.press(screen.getByRole('button', { name: year }));
  };

  it('need the Family plan', async () => {
    await render(<AddMemberScreen />);
    expect(screen.getByText('Family members need the Family plan.')).toBeTruthy();
  });

  it('a child under 13 needs a charged Family plan — the trial is not consent', async () => {
    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'family',
          status: 'trial',
          expiresAt: '2026-10-02T00:00:00Z',
        },
      }),
    );
    await render(<AddMemberScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Mia');
    await pick('May', '2016');
    expect(screen.getByText(/open after your first Family payment/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: parent consent' })).toBeDisabled();
  });

  it('after the first charge, goes to the parent notice', async () => {
    await act(() => {
      useParentPinStore.getState().reset();
    });
    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'family',
          status: 'active',
          expiresAt: '2026-11-01T00:00:00Z',
          firstChargedAt: '2026-10-01T00:00:00Z',
        },
      }),
    );
    await render(<AddMemberScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Mia');
    await pick('May', '2016');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: parent consent' }));
    // Kids are protected by the parent PIN: it is created first (QA R2-05).
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('New PIN'), '2468');
    await fireEvent.changeText(screen.getByLabelText('Repeat the PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Save PIN' }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/family/consent' }),
    );
  });

  const CHILD_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
  const chargedFamily = () =>
    act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'family',
          status: 'active',
          expiresAt: '2026-12-01T00:00:00Z',
          firstChargedAt: '2026-09-20T00:00:00Z',
        },
      }),
    );

  it('the consent screen re-checks its URL: age, plan and id (QA B-06)', async () => {
    mockParams = { id: CHILD_ID, name: 'Mia', month: '5', year: '2010' };
    await chargedFamily();
    await render(<ParentConsentScreen />);
    expect(screen.getByText('The consent step is only for children under 13.')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I am the parent or legal guardian and I agree' }),
    );
    expect(screen.getByRole('button', { name: 'Create the profile' })).toBeDisabled();
    expect(useFamilyStore.getState().profiles.some((p) => p.id === CHILD_ID)).toBe(false);
  });

  it('the parent notice must be accepted, then the child profile opens its onboarding', async () => {
    mockParams = { id: CHILD_ID, name: 'Mia', month: '5', year: '2016' };
    await chargedFamily();
    await render(<ParentConsentScreen />);
    expect(screen.getByText(/No photos, no body measurements/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create the profile' })).toBeDisabled();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'I am the parent or legal guardian and I agree' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create the profile' }));
    const child = useFamilyStore.getState().profiles.find((p) => p.id === CHILD_ID)!;
    expect(child).toMatchObject({ kind: 'child', name: 'Mia' });
    expect(child.consentAt).toBeTruthy();
    expect(useFamilyStore.getState().activeId).toBe(CHILD_ID);
    expect(useOnboardingStore.getState()).toMatchObject({ who: 'child', birthYear: 2016 });
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/who');
  });

  it('a parent or grandparent profile works on the trial', async () => {
    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'family',
          status: 'trial',
          expiresAt: '2026-10-02T00:00:00Z',
        },
      }),
    );
    await render(<AddMemberScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'My parent or grandparent' }));
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Joe');
    await pick('January', '2008');
    await fireEvent.press(screen.getByRole('button', { name: 'Create profile' }));
    expect(useFamilyStore.getState().profiles.map((p) => p.kind)).toEqual(['self', 'parent']);
    expect(useOnboardingStore.getState()).toMatchObject({ who: 'parent', birthYear: 2008 });
  });
});

describe('Delete account', () => {
  it('explains the store subscription is separate and needs the typed word', async () => {
    await render(<DeleteAccountScreen />);
    expect(screen.getByText(/does not cancel a subscription/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Delete my data' });
    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my data' }));
    expect(mockInvoke).not.toHaveBeenCalled(); // no saved account: only this phone
    expect(useOnboardingStore.getState().onboardingComplete).toBe(false);
    expect(mockRouter.replace).toHaveBeenCalledWith('/welcome');
  });

  it('a saved account is deleted on the server first', async () => {
    await act(() => useAccountStore.getState().update({ saved: true }));
    await render(<DeleteAccountScreen />);
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: { confirm: 'DELETE' } });
    expect(useAccountStore.getState().saved).toBe(false);
  });
});
