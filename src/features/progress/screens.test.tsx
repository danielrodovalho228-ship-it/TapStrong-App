import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FamilyScreen from '@/app/(tabs)/family';
import ProgressScreen from '@/app/(tabs)/progress';
import BeforeAfterScreen from '@/app/before-after';
import CheckinScreen from '@/app/checkin';
import RepairScreen from '@/app/repair/index';
import RepairTestScreen from '@/app/repair/test/[key]';
import RestrictionsScreen from '@/app/restrictions';
import { FREE, useBillingStore } from '@/features/billing/store';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { useWorkoutStore } from '@/features/workout/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import { useProgressStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/features/progress/photos', () => ({
  takePhoto: jest.fn(async () => ({ status: 'cancelled' })),
  deletePhotoFile: jest.fn(),
  deleteAllPhotos: jest.fn(),
}));

const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };
const events: string[] = [];
setAnalyticsSink((event) => events.push(event));

const born = async (birthYear: number) =>
  act(() => {
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear });
  });

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T12:00:00Z');
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'f',
      daysPerWeek: 3,
      onboardingComplete: true,
    });
    useWorkoutStore.getState().reset();
    useProgressStore.getState().reset();
    useRestrictionsStore.getState().reset();
    useBillingStore.getState().reset();
    useFamilyStore.getState().reset();
  });
  mockParams = {};
  events.length = 0;
  Object.values(router).forEach((m) => m.mockClear?.());
});

describe('Progress tab (mockup 18)', () => {
  it('adults get measurements and the photo link', async () => {
    await render(<ProgressScreen />);
    expect(screen.getByText('Measurements')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Before & after photos' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Repair check: find weak spots' }));
    expect(router.push).toHaveBeenCalledWith('/repair');
  });

  it('a teen gets a strength-only check-in and no photos', async () => {
    await born(2011);
    await render(<ProgressScreen />);
    expect(screen.getByText('Your check-in compares your strength every 4 weeks.')).toBeTruthy();
    expect(screen.queryByText('Measurements')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Before & after photos' })).toBeNull();
  });
});

describe('4-week check-in (mockup 25)', () => {
  it('adults can add waist and weight, and see WHtR', async () => {
    await act(() => useOnboardingStore.getState().update({ heightCm: 168, units: 'metric' }));
    await render(<CheckinScreen />);
    await fireEvent.changeText(screen.getByLabelText('Waist (cm)'), '84');
    await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '70');
    expect(screen.getByText('0.50')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save my check-in' }));
    expect(useProgressStore.getState().checkins[0]).toMatchObject({ waistCm: 84, whtr: 0.5 });
    expect(events).toContain('checkin_completed');
  });

  it('minors never see body fields, and nothing body-related is saved', async () => {
    await born(2011);
    await render(<CheckinScreen />);
    expect(screen.queryByText('Body (optional)')).toBeNull();
    expect(screen.queryByLabelText(/Waist/)).toBeNull();
    expect(
      screen.getByText(
        'Your check-in is about getting stronger. No body measurements for under-18s.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save my check-in' }));
    const saved = useProgressStore.getState().checkins[0];
    expect(saved.waistCm).toBeUndefined();
    expect(saved.bmi).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Photos' })).toBeNull();
  });
});

describe('Before & after (mockup 26)', () => {
  it('is for adults only', async () => {
    await render(<BeforeAfterScreen />);
    expect(screen.getByText('Before & after')).toBeTruthy();
  });

  it.each([2011, 2016, 1950])('redirects when born in %s', async (year) => {
    await born(year);
    await render(<BeforeAfterScreen />);
    expect(screen.getByText('redirect:/progress')).toBeTruthy();
  });
});

describe('Repair check (mockup 17)', () => {
  it('leaves out tests the safety answers rule out', async () => {
    await act(() => useOnboardingStore.getState().update({ painAreas: ['knee'] }));
    await render(<RepairScreen />);
    expect(screen.queryByText('Sit-to-stand (30 s)')).toBeNull();
    expect(
      screen.getByText('1 test is left out because of your safety answers or restrictions.'),
    ).toBeTruthy();
  });

  it('records a result, then the plan is Premium', async () => {
    mockParams = { key: 'squat' };
    await render(<RepairTestScreen />);
    for (let i = 0; i < 8; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Increase Stands counted' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Save result' }));
    expect(useProgressStore.getState().repairResults[0]).toMatchObject({
      testKey: 'squat',
      value: 8,
    });
    expect(events).toContain('repair_test_completed');

    await act(() => {
      const at = '2026-09-28T11:00:00Z';
      const save = useProgressStore.getState().saveRepairResult;
      save({ testKey: 'single_leg_balance', left: 30, right: 30, testedAt: at });
      save({ testKey: 'glute_bridge_hold', value: 40, testedAt: at });
      save({ testKey: 'front_plank', value: 60, testedAt: at });
      save({ testKey: 'shoulder_reach', passLeft: true, passRight: true, testedAt: at });
    });
    await render(<RepairScreen />);
    expect(screen.getByRole('button', { name: 'Sit-to-stand (30 s), Low' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Build my 6-week repair plan' }));
    expect(router.push).toHaveBeenCalledWith('/paywall');
    expect(useProgressStore.getState().repairPlan).toBeNull();

    await act(() =>
      useBillingStore.getState().set({
        entitlement: {
          ...FREE,
          plan: 'premium',
          status: 'active',
          expiresAt: '2026-12-01T00:00:00Z',
        },
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Build my 6-week repair plan' }));
    expect(router.push).toHaveBeenCalledWith('/repair/plan');
    expect(useProgressStore.getState().repairPlan?.focus.map((f) => f.muscleKey)).toEqual([
      'quads',
      'glutes',
    ]);
  });
});

describe('My restrictions (mockup 20)', () => {
  it('adds a manual restriction, marks it healed and turns it back on', async () => {
    await render(<RestrictionsScreen />);
    expect(screen.getByText(/^No restrictions/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a restriction' }));
    await fireEvent.press(screen.getByText('Knee'));
    await fireEvent.press(screen.getByText('Both sides'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save restriction' }));
    const [r] = useRestrictionsStore.getState().items;
    expect(r).toMatchObject({ area: 'knee', source: 'manual', active: true });
    expect(r.side).toBeUndefined();
    expect(screen.getByText(/exercises in your library are left out/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Mark healed'));
    expect(useRestrictionsStore.getState().items[0].active).toBe(false);
    await fireEvent.press(screen.getByText('Turn back on'));
    expect(useRestrictionsStore.getState().items[0].active).toBe(true);
  });

  it('shows the safety-check areas too', async () => {
    await act(() => useOnboardingStore.getState().update({ painAreas: ['shoulder'] }));
    await render(<RestrictionsScreen />);
    expect(screen.getByText('Shoulder')).toBeTruthy();
    expect(screen.getByText('Change in safety check')).toBeTruthy();
  });
});

describe('Family dashboard', () => {
  const setup = async (activeId: string) => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          { id: 'gran', kind: 'parent', name: 'Rosa', createdAt: '2026-09-02T00:00:00Z' },
        ],
        activeId,
      });
    });
    kvStorage.setItem(
      'profile-snapshot:gran',
      JSON.stringify({
        workouts: [
          {
            id: 'w',
            kind: 'regular',
            status: 'done',
            createdAt: '2026-09-27T10:00:00Z',
            startedAt: '2026-09-27T10:00:00Z',
            endedAt: '2026-09-27T10:25:00Z',
            session: { items: [] },
            logs: [
              { itemId: 'i', exerciseId: 'e', setNo: 1, reps: 8, loggedAt: '2026-09-27T10:10:00Z' },
            ],
            skipped: [],
            swaps: [],
            pains: [],
          },
        ],
        streak: null,
      }),
    );
  };

  it("the plan owner sees each member's week", async () => {
    await setup('me');
    await render(<FamilyScreen />);
    expect(screen.getByText('Your family this week')).toBeTruthy();
    expect(screen.getByText('1 workout this week · 25 min')).toBeTruthy();
  });

  it('members do not see the dashboard', async () => {
    await setup('gran');
    await render(<FamilyScreen />);
    expect(screen.queryByText('Your family this week')).toBeNull();
  });
});
