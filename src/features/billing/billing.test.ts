import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import { useAccountStore } from '../account/store';
import { buildSyncPlan } from '../account/sync';
import { useFamilyStore } from '../family/store';
import { ensureSelfProfile, switchProfile } from '../family/switch';
import { planNotifications } from '../notifications/plan';
import { evaluateAgeGate } from '../onboarding/age-gate';
import { initialOnboarding, useOnboardingStore } from '../onboarding/store';
import { initialStreak } from '../workout/streak';
import { useWorkoutStore } from '../workout/store';
import type { WorkoutRecord } from '../workout/types';

import { devProvider, simulateFirstCharge } from './devProvider';
import {
  canStartWorkout,
  currentPlan,
  FAMILY_MAX_PROFILES,
  manageSubscriptionUrl,
  priceLabel,
  PRODUCTS,
  workoutsThisWeek,
} from './rules';
import { FREE, useBillingStore } from './store';

const realNow = clock.now;
const at = (iso: string) => (clock.now = () => new Date(iso));
afterEach(() => {
  clock.now = realNow;
});

const workout = (startedAt: string, kind: 'regular' | 'finisher' = 'regular'): WorkoutRecord => ({
  id: startedAt + kind,
  kind,
  createdAt: startedAt,
  startedAt,
  status: 'done',
  session: {
    items: [],
    minutes: 30,
    warmupMinutes: 5,
    cooldownMinutes: 4,
    estimatedMinutes: 30,
    notes: [],
  },
  logs: [],
  skipped: [],
  swaps: [],
  pains: [],
});

describe('free plan limit (3 workouts a week)', () => {
  // Saturday Sep 26 2026; weeks start Sunday by default.
  const now = new Date(2026, 8, 26, 12);
  const week = [
    workout(new Date(2026, 8, 21, 9).toISOString()),
    workout(new Date(2026, 8, 23, 9).toISOString()),
    workout(new Date(2026, 8, 24, 9).toISOString(), 'finisher'),
    workout(new Date(2026, 8, 19, 9).toISOString()), // last week
  ];

  it('counts started regular workouts this calendar week, not finishers', () => {
    expect(workoutsThisWeek(week, now, 0)).toBe(2);
    expect(canStartWorkout('free', week, now, 0)).toEqual({ allowed: true });
  });

  it('blocks the 4th on Free and says when the next free one is', () => {
    const full = [...week, workout(new Date(2026, 8, 25, 9).toISOString())];
    expect(canStartWorkout('free', full, now, 0)).toEqual({
      allowed: false,
      nextFreeDay: '2026-09-27',
    });
    expect(canStartWorkout('premium', full, now, 0)).toEqual({ allowed: true });
    expect(canStartWorkout('family', full, now, 0)).toEqual({ allowed: true });
  });
});

describe('prices and cancel links', () => {
  it('uses store prices when known, else the list prices Daniel set', () => {
    expect(priceLabel({}, 'premium', 'monthly')).toBe('$9.99');
    expect(priceLabel({}, 'premium', 'annual')).toBe('$59.99');
    expect(priceLabel({}, 'family', 'monthly')).toBe('$14.99');
    expect(priceLabel({}, 'family', 'annual')).toBe('$89.99');
    expect(priceLabel({ [PRODUCTS.family.monthly]: 'R$ 79,90' }, 'family', 'monthly')).toBe(
      'R$ 79,90',
    );
  });

  it('opens the right store subscription page', () => {
    expect(manageSubscriptionUrl('ios', null)).toBe('https://apps.apple.com/account/subscriptions');
    expect(manageSubscriptionUrl('android', PRODUCTS.family.monthly)).toContain(
      'package=app.tapstrong&sku=tapstrong_family_monthly',
    );
  });
});

describe('development purchase simulator', () => {
  beforeEach(() => useBillingStore.getState().reset());

  it('starts a 7-day trial with no charge, then the first charge', async () => {
    at('2026-10-01T10:00:00Z');
    await devProvider.purchase(PRODUCTS.family.monthly);
    const trial = useBillingStore.getState().entitlement;
    expect(trial).toMatchObject({ plan: 'family', status: 'trial', firstChargedAt: null });
    expect(trial.trialEndsAt).toBe('2026-10-08T10:00:00.000Z');
    expect(currentPlan(trial, clock.now())).toBe('family');
    simulateFirstCharge();
    expect(useBillingStore.getState().entitlement).toMatchObject({
      status: 'active',
      firstChargedAt: '2026-10-01T10:00:00.000Z',
    });
    expect(currentPlan(FREE, clock.now())).toBe('free');
  });

  it('does not offer a second trial', async () => {
    await devProvider.purchase(PRODUCTS.premium.monthly);
    useBillingStore.getState().set({ entitlement: FREE });
    await devProvider.purchase(PRODUCTS.premium.monthly);
    expect(useBillingStore.getState().entitlement.status).toBe('active');
  });
});

describe('trial reminder', () => {
  it('is scheduled 3 days before the charge even with other reminders off', () => {
    const plan = planNotifications({
      prefs: {
        reminders: false,
        reminderTime: '18:30',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
      daysPerWeek: 3,
      streak: 0,
      lastActive: null,
      now: new Date('2026-10-01T10:00:00Z'),
      trialChargeAt: '2026-10-08T10:00:00Z',
    });
    expect(plan).toEqual([
      {
        id: 'trial-reminder',
        kind: 'trial',
        date: new Date('2026-10-05T10:00:00Z'),
        chargeOn: '2026-10-08T10:00:00Z',
      },
    ]);
  });
});

describe('children under 13', () => {
  const today = { year: 2026, month: 9 };
  it('stay blocked at the age gate until the parent consent is recorded', () => {
    expect(evaluateAgeGate('child', { year: 2016, month: 3 }, today).status).toBe(
      'guardian_consent',
    );
    expect(evaluateAgeGate('child', { year: 2016, month: 3 }, today, true).status).toBe('ok');
    // Consent never lets a child sign up alone.
    expect(evaluateAgeGate('me', { year: 2016, month: 3 }, today, true).status).toBe('ask_parent');
  });

  it("sync a child only as the guardian's managed profile, without measurements", () => {
    const onboarding = {
      ...initialOnboarding(),
      birthMonth: 3,
      birthYear: 2016,
      heightCm: 140,
      location: 'home' as const,
      minutes: 20,
    };
    const base = {
      userId: 'guardian',
      profileId: 'child-1',
      onboarding,
      restrictions: [],
      workouts: [],
      streak: initialStreak(),
      activity: {},
      badges: [],
      exerciseIds: new Map(),
      library: [],
    };
    expect(buildSyncPlan(base)).toBe('child');
    const plan = buildSyncPlan({ ...base, managed: true });
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.profile).toMatchObject({
      user_id: null,
      guardian_id: 'guardian',
      mode: 'child',
      height_cm: null,
    });
    expect(plan.profileWrite).toBe('child');
  });
});

describe('family profiles on the phone', () => {
  beforeEach(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
    useWorkoutStore.getState().reset();
  });

  it('holds up to 5 profiles', () => {
    ensureSelfProfile();
    for (let i = 0; i < 10; i++) useFamilyStore.getState().add({ id: `p${i}`, kind: 'parent' });
    expect(useFamilyStore.getState().profiles).toHaveLength(FAMILY_MAX_PROFILES);
  });

  it("keeps each profile's answers and workouts apart when switching", () => {
    useOnboardingStore.getState().update({ birthYear: 1983, birthMonth: 3 });
    useWorkoutStore.setState({ workouts: [workout('2026-09-20T10:00:00Z')] });
    const self = ensureSelfProfile();
    useFamilyStore.getState().add({ id: 'grandma', kind: 'parent', name: 'Ana' });

    switchProfile('grandma', { who: 'parent', birthYear: 1950, birthMonth: 5 });
    expect(useOnboardingStore.getState()).toMatchObject({ who: 'parent', birthYear: 1950 });
    expect(useWorkoutStore.getState().workouts).toHaveLength(0);
    expect(useFamilyStore.getState().activeId).toBe('grandma');

    switchProfile(self.id);
    expect(useOnboardingStore.getState().birthYear).toBe(1983);
    expect(useWorkoutStore.getState().workouts).toHaveLength(1);

    switchProfile('grandma');
    expect(useOnboardingStore.getState().birthYear).toBe(1950);
    expect(kvStorage.getItem(`profile-snapshot:${self.id}`)).toContain('1983');
  });

  it('the owner profile uses the account profile id', () => {
    expect(ensureSelfProfile().id).toBe(useAccountStore.getState().profileId);
  });
});
