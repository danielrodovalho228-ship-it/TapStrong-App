/**
 * QA round 8 — P2 (safety and family screens): the second-workout rule on
 * every path, per-profile modes on the Family tab, the parent PIN in the
 * Restrictions footer, a solo teen's Plans page and "create" PIN wording.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import DayScreen from '@/app/day/[date]';
import RestrictionsScreen from '@/app/restrictions';
import CustomWorkoutScreen from '@/app/workout/custom';
import DoneScreen from '@/app/workout/[id]/done';
import NewWorkoutScreen from '@/app/workout/new';
import SingleWorkoutScreen from '@/app/workout/single';
import { useAccountStore } from '@/features/account/store';
import { useBillingStore } from '@/features/billing/store';
import { devLibrary } from '@/features/exercises/library';
import { FamilyStrip } from '@/features/family/components/FamilyStrip';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { ParentGate } from '@/features/family/ParentGate';
import { useParentPinStore } from '@/features/family/parentPin';
import { summarize } from '@/features/family/profiles';
import { useFamilyStore } from '@/features/family/store';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { todayState } from '@/features/workout/secondWorkout';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
  Stack: { Screen: () => null },
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };
jest.setTimeout(30_000);

const NOW = new Date('2026-09-28T11:00:00');
const main = devLibrary().filter((e) => e.parts.includes('main') && e.pattern !== 'balance');

function doneToday(id = 't1'): WorkoutRecord {
  const at = '2026-09-28T08:30:00';
  return {
    id,
    kind: 'regular',
    createdAt: '2026-09-28T08:00:00',
    startedAt: '2026-09-28T08:00:00',
    endedAt: '2026-09-28T08:45:00',
    status: 'done',
    session: {
      items: [
        {
          id: 'm',
          role: 'main',
          part: 'main',
          exerciseId: main[0].id,
          targetMuscle: main[0].muscles[0].muscleKey,
          goal: 'strengthen',
          sets: 3,
          reps: [8, 12],
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 300,
        },
      ],
      minutes: 30,
      warmupMinutes: 6,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: [1, 2, 3].map((setNo) => ({
      itemId: 'm',
      exerciseId: main[0].id,
      setNo,
      reps: 10,
      loggedAt: at,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

async function profile(birthYear: number) {
  await act(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      daysPerWeek: 3,
      minutes: 30,
      location: 'home',
      mainGoals: ['strength'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      onboardingComplete: true,
    });
    useWorkoutStore.getState().reset();
    useBillingStore.getState().reset();
  });
}

beforeAll(() => {
  clock.now = () => NOW;
});
beforeEach(() => {
  mockParams = {};
  Object.values(router).forEach((m) => m.mockClear?.());
});

describe('second workout: every path follows the rule', () => {
  it('60+ after the day’s workout: Single and Custom go Home, My plan goes Home', async () => {
    await profile(1958);
    await act(() => useWorkoutStore.setState({ workouts: [doneToday()] }));
    await render(<SingleWorkoutScreen />);
    expect(screen.getByText('redirect:/home')).toBeTruthy();
    await render(<CustomWorkoutScreen />);
    expect(screen.getByText('redirect:/home')).toBeTruthy();
    await render(<NewWorkoutScreen />);
    await fireEvent.press(screen.getByText('My plan'));
    expect(router.replace).toHaveBeenCalledWith('/home');
  });

  it('an adult after the day’s workout may still build one (the extra)', async () => {
    await profile(1990);
    await act(() => useWorkoutStore.setState({ workouts: [doneToday()] }));
    await render(<SingleWorkoutScreen />);
    expect(screen.queryByText('redirect:/home')).toBeNull();
  });

  it('a free adult with the week’s workouts used gets no Extra workout', () => {
    const three = [doneToday('a'), doneToday('b'), doneToday('c')];
    const free = useBillingStore.getState().entitlement;
    expect(
      todayState({ workouts: three, now: NOW, mode: 'adult', entitlement: free }),
    ).toMatchObject({ doneToday: true, extraAllowed: false });
    expect(
      todayState({
        workouts: three,
        now: NOW,
        mode: 'adult',
        entitlement: {
          ...free,
          plan: 'premium',
          status: 'active',
          expiresAt: '2027-01-01T00:00:00Z',
        },
      }).extraAllowed,
    ).toBe(true);
    expect(
      todayState({ workouts: three, now: NOW, mode: 'senior', entitlement: free }).extraAllowed,
    ).toBe(false);
  });

  it('60+ done screen: no "Add 10 min", "Push next time" stays', async () => {
    await profile(1958);
    await act(() => useWorkoutStore.setState({ workouts: [doneToday()] }));
    mockParams = { id: 't1' };
    await render(<DoneScreen />);
    expect(screen.queryByRole('button', { name: /Add 10 min/ })).toBeNull();
    expect(screen.getByRole('button', { name: /next time/i })).toBeTruthy();
    await profile(1990);
    await act(() => useWorkoutStore.setState({ workouts: [doneToday()] }));
    await render(<DoneScreen />);
    expect(screen.getByRole('button', { name: /Add 10 min/ })).toBeTruthy();
  });

  it('today’s day page after the workout: no preview of another one', async () => {
    await profile(1990);
    await act(() => useWorkoutStore.setState({ workouts: [doneToday()] }));
    mockParams = { date: '2026-09-28' };
    await render(<DayScreen />);
    expect(screen.queryByText(/^Preview$/i)).toBeNull();
    expect(screen.getByText("Today's workout is done")).toBeTruthy();
  });
});

describe('family and teen screens', () => {
  it('the owner is never shown in teen mode while a teen is active', async () => {
    await profile(1985);
    await act(() => {
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
      kvStorage.setItem(
        'profile-snapshot:owner',
        JSON.stringify({ onboarding: { birthMonth: 3, birthYear: 1985 } }),
      );
    });
    const live = useOnboardingStore.getState();
    const [owner, teen] = useFamilyStore.getState().profiles;
    expect(summarize(owner, 'teen', live, kvStorage.getItem).mode).toBe('adult');
    expect(summarize(teen, 'teen', { ...live, birthYear: 2011 }, kvStorage.getItem).mode).toBe(
      'teen',
    );
  });

  it('a solo 17-year-old sees no Add card; an adult owner does', async () => {
    await profile(1985);
    await render(<FamilyStrip />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    await profile(2009);
    await render(<FamilyStrip />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByText(/Up to/)).toBeNull();
  });

  it('Restrictions: "Mark healed" asks for the PIN in the footer', async () => {
    await profile(2011);
    await act(() => {
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
      useParentPinStore.getState().reset();
      useRestrictionsStore.setState({
        items: [
          {
            id: 'r1',
            area: 'knee',
            source: 'manual',
            active: true,
            createdAt: '2026-09-01T00:00:00Z',
          } as never,
        ],
      });
    });
    await render(<RestrictionsScreen />);
    await fireEvent.press(screen.getByText('Mark healed'));
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('no PIN yet on an upgraded phone: "create" wording, never "reset"', async () => {
    await act(() => {
      useParentPinStore.getState().reset();
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
        ownerAuth: { email: 'dan@example.com', userId: 'u' },
      });
      useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
    });
    await render(<ParentGate onPass={() => undefined} onCancel={() => undefined} />);
    expect(screen.queryByText(/Settings/)).toBeNull();
    expect(screen.getByText(/create one now/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a PIN with the account email' }));
    expect(screen.getByText('Create the parent PIN')).toBeTruthy();
    expect(screen.queryByText('Reset the parent PIN')).toBeNull();
  });

  it('a locked teen with an adult year hears about the teen lock', () => {
    expect(
      evaluateAgeGate('child', { year: 1990, month: 3 }, { year: 2026, month: 9 }, false, 'teen')
        .status,
    ).toBe('teen_locked');
  });
});
