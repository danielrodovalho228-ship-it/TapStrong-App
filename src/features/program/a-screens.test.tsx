/**
 * Improvements v1, package A — screens: Home week strip and block label,
 * day view, workout modes, single and custom workouts, plans, teen sharing.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import DayScreen from '@/app/day/[date]';
import ProgramScreen from '@/app/program/[id]';
import ProgramsScreen from '@/app/programs';
import CustomWorkoutScreen from '@/app/workout/custom';
import NewWorkoutScreen from '@/app/workout/new';
import DoneScreen from '@/app/workout/[id]/done';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { useProgramStore } from './store';

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
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

const LIBRARY = devLibrary();

beforeAll(() => {
  clock.now = () => new Date('2026-09-30T09:00:00');
});

async function adult(extra: Record<string, unknown> = {}) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1985,
      sex: 'f',
      daysPerWeek: 3,
      minutes: 40,
      weightKg: 70,
      mainGoals: ['strength'],
      muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
      onboardingComplete: true,
      ...extra,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useProgramStore.getState().reset();
    useFamilyStore.getState().reset();
  });
  Object.values(router).forEach((m) => m.mockClear?.());
}

describe('Home (A1–A3)', () => {
  it('week strip, "Week N of 5 · Build · day name" and "N exercises · N min · kcal"', async () => {
    await adult();
    await render(<HomeScreen />);
    expect(screen.getByTestId('week-strip')).toBeTruthy();
    expect(screen.getByText(/^Week \d of 5 · Build/)).toBeTruthy();
    expect(screen.getByText(/exercises? · \d+ min · about \d+ kcal/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('week-2026-10-02'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/day/[date]',
      params: { date: '2026-10-02' },
    });
  });

  it('a teen sees no kcal', async () => {
    await adult({ birthYear: 2011 });
    await render(<HomeScreen />);
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('"Pick something else" opens the workout modes', async () => {
    await adult();
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pick something else' }));
    expect(router.push).toHaveBeenCalledWith('/workout/new');
  });
});

describe('day view (A1)', () => {
  it('a future day previews the session, no Start', async () => {
    await adult();
    mockParams = { date: '2026-10-02' };
    await render(<DayScreen />);
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Start today's workout" })).toBeNull();
  });

  it('a past day shows the log', async () => {
    await adult();
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
    const session = generateSession(input);
    const m = session.items.find((i) => i.role === 'main')!;
    await act(() =>
      useWorkoutStore.setState({
        workouts: [
          {
            id: 'p1',
            kind: 'regular',
            createdAt: '2026-09-28T09:00:00',
            endedAt: '2026-09-28T10:00:00',
            status: 'done',
            session,
            logs: [
              {
                itemId: m.id,
                exerciseId: m.exerciseId,
                setNo: 1,
                reps: 10,
                load: 50,
                unit: 'lb',
                loggedAt: '2026-09-28T09:30:00',
              },
            ],
            skipped: [],
            swaps: [],
            pains: [],
          },
        ],
      }),
    );
    mockParams = { date: '2026-09-28' };
    await render(<DayScreen />);
    expect(screen.getByText(/1 set · 50 lb/)).toBeTruthy();
  });
});

describe('workout modes (A6)', () => {
  it('My plan, Single, Custom and Plans; 60+ has no Custom', async () => {
    await adult();
    await render(<NewWorkoutScreen />);
    for (const name of [/^My plan/, /^Single workout/, /^Custom workout/, /^Ready-made plans/])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    await adult({ birthYear: 1950 });
    await render(<NewWorkoutScreen />);
    expect(screen.queryByRole('button', { name: /^Custom workout/ })).toBeNull();
  });

  it('Custom: pick from safe exercises, start the list', async () => {
    await adult({ restrictions: [] });
    await render(<CustomWorkoutScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'bench press');
    const add = screen.getAllByRole('button', { name: /^Add / })[0];
    await fireEvent.press(add);
    expect(screen.getByText('1 exercise chosen')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start this workout' }));
    const w = useWorkoutStore.getState().workouts[0];
    expect(w.session.items.filter((i) => i.role === 'main')).toHaveLength(1);
  });
});

describe('ready-made plans (A5)', () => {
  it('lists My plan first; choosing a plan sets it, My plan goes back', async () => {
    await adult();
    await render(<ProgramsScreen />);
    expect(screen.getByRole('button', { name: /^My plan/ })).toBeTruthy();
    mockParams = { id: 'muscle-ppl-3' };
    await render(<ProgramScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use this plan' }));
    expect(useProgramStore.getState().planId).toBe('muscle-ppl-3');
    mockParams = { id: 'mine' };
    await render(<ProgramScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to My plan' }));
    expect(useProgramStore.getState().planId).toBeNull();
  });
});

describe('sharing a teen workout (A7)', () => {
  it('a managed teen can share only after the parent turns it on', async () => {
    await adult({ birthYear: 2011 });
    await act(() =>
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
        ],
        activeId: 't1',
      }),
    );
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
    const id = useWorkoutStore.getState().create(generateSession(input));
    await act(() => useWorkoutStore.getState().finish(id, 'done'));
    mockParams = { id };
    await render(<DoneScreen />);
    expect(screen.queryByRole('button', { name: 'Share my map' })).toBeNull();
    expect(screen.getByText(/Sharing is off for this profile/)).toBeTruthy();
    await act(() => useFamilyStore.getState().setShareAllowed('t1', true));
    await render(<DoneScreen />);
    expect(screen.getByRole('button', { name: 'Share my map' })).toBeTruthy();
  });
});
