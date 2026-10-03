/**
 * Phase 31, package F: the Library (rows by days a week, goal labels, care
 * programs, equipment / muscles / time filters), the Library equipment screen
 * (presets, deselect all, discard or done, never the profile), Progress with
 * Activity and Body, the Settings list and the compact plan list.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import LibraryScreen from '@/app/(tabs)/library';
import ProgressScreen from '@/app/(tabs)/progress';
import SettingsScreen from '@/app/(tabs)/settings';
import LibraryEquipmentScreen from '@/app/library-equipment';
import { PRESETS } from '@/features/equipment/catalog';
import { hasWeights, usePlanFilterStore } from '@/features/library/planFilter';
import { GYM_EQUIPMENT_OPTIONS } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { READY_PLANS } from '@/features/program/plans';
import { usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';

import { useWorkoutStore } from '../workout/store';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
const router = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

jest.setTimeout(30_000);
beforeAll(() => {
  clock.now = () => new Date('2026-10-01T18:00:00');
});

async function as(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['strength'],
      minutes: 30,
      muscleGoals: [{ muscleKey: 'chest', goal: 'grow' }],
      onboardingComplete: true,
      units: 'metric',
      equipment: GYM_EQUIPMENT_OPTIONS,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    usePlanFilterStore.getState().reset();
    usePrefsStore.getState().reset();
  });
  Object.values(router).forEach((m) => m.mockClear?.());
}

const labelsIn = (rowTestId: string) =>
  within(screen.getByTestId(rowTestId))
    .getAllByTestId('plan-card')
    .map((c) => c.props.accessibilityLabel as string);

describe('Library', () => {
  it('rows of 3, 4, 5 and 6 days with big cards and goal labels; no calories', async () => {
    await as(1990);
    await render(<LibraryScreen />);
    for (const d of [3, 4, 5, 6]) expect(screen.getByTestId(`plan-row-${d}`)).toBeTruthy();
    expect(screen.getByText('3 days a week')).toBeTruthy();
    expect(screen.getAllByText('Get fit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Build muscle').length).toBeGreaterThan(0);
    expect(screen.queryByText(/kcal|calorie/i)).toBeNull();
    // One card per goal in a row.
    const goals = labelsIn('plan-row-3').map((l) => l.split(',')[0]);
    expect(new Set(goals).size).toBe(goals.length);
  });

  it('the shoulder program sits in Care programs', async () => {
    await as(1990);
    await render(<LibraryScreen />);
    expect(screen.getByText('Shoulder — rehab')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('care-card'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/rehab/[id]',
      params: { id: 'shoulder_mobility_strength' },
    });
  });

  it('60+ get 2, 3 and 4 days and "Mobility 60+"', async () => {
    await as(1955);
    await render(<LibraryScreen />);
    expect(screen.getByTestId('plan-row-2')).toBeTruthy();
    expect(screen.queryByTestId('plan-row-6')).toBeNull();
    expect(screen.getAllByText('Mobility 60+').length).toBeGreaterThan(0);
  });

  it('filters: equipment opens its screen, bodyweight hides weight plans, time keeps ≤ 30 min', async () => {
    await as(1990);
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByText(/^Equipment \(\d+\) ▾$/));
    expect(router.push).toHaveBeenCalledWith('/library-equipment');

    await act(() => usePlanFilterStore.getState().setEquipment([...PRESETS.bodyweight.items]));
    const ids = (row: string) =>
      within(screen.getByTestId(row))
        .getAllByTestId('plan-card')
        .map((c) => c.props.accessibilityLabel as string);
    for (const label of ids('plan-row-3')) expect(label).not.toMatch(/^Build muscle|^Get stronger/);

    await fireEvent.press(screen.getByText('30 min or less'));
    expect(usePlanFilterStore.getState().short).toBe(true);
    for (const label of ids('plan-row-3')) {
      const minutes = Number(/(\d+) min/.exec(label)![1]);
      expect(minutes).toBeLessThanOrEqual(30);
    }

    await fireEvent.press(screen.getByText('Muscles (0) ▾'));
    expect(screen.getByTestId('plan-muscles')).toBeTruthy();
  });

  it('hasWeights: weights or machines, not bands or bodyweight', () => {
    expect(hasWeights(['dumbbells'])).toBe(true);
    expect(hasWeights([...PRESETS.bodyweight.items])).toBe(false);
    expect(READY_PLANS.some((p) => p.equipment === 'weights')).toBe(true);
  });
});

describe('Library → Equipment', () => {
  it('presets, deselect all, Done applies to the Library only', async () => {
    await as(1990);
    const before = [...useOnboardingStore.getState().equipment];
    await render(<LibraryEquipmentScreen />);
    expect(screen.getByText("Your choices here don't change your current plan.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Deselect all'));
    expect(screen.getByTestId('equipment-count').props.children).toBe('Selected equipment (0)');
    await fireEvent.press(screen.getByText('Home'));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(usePlanFilterStore.getState().equipment).toEqual(PRESETS.homeGym.items);
    expect(useOnboardingStore.getState().equipment).toEqual(before);
  });

  it('Discard keeps the filter as it was', async () => {
    await as(1990);
    await render(<LibraryEquipmentScreen />);
    await fireEvent.press(screen.getByText('Bodyweight'));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(usePlanFilterStore.getState().equipment).toBeNull();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Progress', () => {
  it('Activity with ranges, Body with the recovery map; no calories', async () => {
    await as(1990);
    await render(<ProgressScreen />);
    expect(screen.getByRole('radio', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByTestId('activity-workouts')).toBeTruthy();
    expect(screen.queryByText(/kcal|calorie|nutrition/i)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
    expect(screen.getByTestId('progress-recovery')).toBeTruthy();
    expect(screen.queryByText(/kcal|calorie|nutrition/i)).toBeNull();
  });
});

describe('Settings', () => {
  it('the list: plan card, smart weights, rest, warm-up (never off), display, health, legal, delete', async () => {
    await as(1990);
    await render(<SettingsScreen />);
    expect(screen.getByTestId('settings-plan')).toBeTruthy();
    const smart = screen.getByRole('switch', { name: 'Smart weights and reps' });
    await fireEvent.press(smart);
    expect(usePrefsStore.getState().smartLoads).toBe(false);
    expect(screen.getByRole('button', { name: 'Rest between strength sets' })).toBeTruthy();
    // Warm-up and cool-down: standard or short, no "off".
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Short' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Compact list' }));
    expect(usePrefsStore.getState().planView).toBe('list');
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
    expect(screen.getByText(/Terms/)).toBeTruthy();
  });

  it('a teen has no smart-weights switch (minors never see load)', async () => {
    await as(new Date().getFullYear() - 15);
    await render(<SettingsScreen />);
    expect(screen.queryByRole('switch', { name: 'Smart weights and reps' })).toBeNull();
  });
});

it('the compact list shows rows instead of big cards', async () => {
  await as(1990);
  await act(() => usePrefsStore.getState().set({ planView: 'list' }));
  await render(<HomeScreen />);
  expect(screen.queryAllByTestId('plan-card')).toHaveLength(0);
  expect(screen.getAllByTestId('plan-row').length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('plan-card-swap').length).toBeGreaterThan(0);
});
