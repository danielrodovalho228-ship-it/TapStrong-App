/**
 * QA R3-03 / R3-06 — Home never promises a workout that doesn't exist: when
 * everything is recovering it offers short mobility, balance or rest; 60+
 * Home has Short mobility and shows the session's own minutes.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import { devLibrary } from '@/features/exercises/library';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { SeniorHome } from '@/features/senior/SeniorHome';
import { clock } from '@/lib/clock';

import { useWorkoutStore } from './store';
import type { WorkoutRecord } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

// Hundreds of logged sets per render: room for slow, parallel runs.
jest.setTimeout(30_000);

const NOW = '2026-09-28T09:00:00';

/** Yesterday's session that trained every muscle in the library. */
function everythingYesterday(): WorkoutRecord {
  const main = devLibrary().filter((e) => e.parts.includes('main') && e.pattern !== 'balance');
  const at = '2026-09-27T09:30:00';
  return {
    id: 'y1',
    kind: 'regular',
    createdAt: '2026-09-27T09:00:00',
    startedAt: '2026-09-27T09:00:00',
    endedAt: '2026-09-27T10:00:00',
    status: 'done',
    session: {
      items: [
        {
          id: 'm',
          role: 'main',
          part: 'main',
          exerciseId: main[0].id,
          targetMuscle: null,
          goal: null,
          sets: 1,
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 60,
        },
      ],
      minutes: 60,
      warmupMinutes: 6,
      cooldownMinutes: 5,
      estimatedMinutes: 60,
      notes: [],
    },
    logs: main.map((e, n) => ({
      itemId: 'm',
      exerciseId: e.id,
      setNo: n + 1,
      reps: 8,
      loggedAt: at,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

async function profile(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      daysPerWeek: 4,
      minutes: 30,
      location: 'home',
      position: 'standing',
      mainGoals: ['strength'],
      muscleGoals: [
        { muscleKey: 'quads', goal: 'strengthen' },
        { muscleKey: 'chest', goal: 'strengthen' },
      ],
      onboardingComplete: true,
    });
    useWorkoutStore.getState().reset();
    useProgressStore.getState().reset();
  });
}

beforeAll(() => {
  clock.now = () => new Date(NOW);
});
beforeEach(() => Object.values(router).forEach((m) => m.mockClear?.()));

describe('R3-03 all-recovering Home', () => {
  it('shows the recovering state with mobility, balance and rest, not a workout Start', async () => {
    await profile(1990);
    await act(() => useWorkoutStore.setState({ workouts: [everythingYesterday()] }));
    await render(<HomeScreen />);
    expect(screen.getByRole('header', { name: 'Everything is recovering' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Short mobility/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rest today' }));
    expect(screen.getByText(/Rest is part of training/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Short balance/ }));
    const id = router.push.mock.calls.at(-1)![0].params.id;
    expect(id).not.toBe('unavailable');
    const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
    expect(w.kind).toBe('mobility');
    expect(w.session.focus).toBe('balance');
  });

  it('a normal day still shows the workout card', async () => {
    await profile(1990);
    await render(<HomeScreen />);
    expect(screen.queryByRole('header', { name: 'Everything is recovering' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Start/ })).toBeTruthy();
  });
});

describe('R3-06 60+ Home', () => {
  it('SeniorHome shows the minutes it is given', async () => {
    await profile(1955);
    await render(
      <SeniorHome
        onStart={jest.fn()}
        onMobility={jest.fn()}
        onBalance={jest.fn()}
        targets={[]}
        minutes={28}
      />,
    );
    expect(screen.getByText('Today · 28 minutes')).toBeTruthy();
  });

  it('has Short mobility and shows the session minutes, not the profile setting', async () => {
    await profile(1955);
    await render(<HomeScreen />);
    // Home passes the session's own estimate; the profile says 30.
    expect(screen.queryByText('Today · 30 minutes')).toBeNull();
    expect(screen.getByText(/^Today · \d+ minutes$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Short mobility/ }));
    const id = router.push.mock.calls.at(-1)![0].params.id;
    expect(useWorkoutStore.getState().workouts.find((x) => x.id === id)?.kind).toBe('mobility');
  });

  it('all recovering: balance, mobility or rest', async () => {
    await profile(1955);
    await act(() => useWorkoutStore.setState({ workouts: [everythingYesterday()] }));
    await render(<HomeScreen />);
    expect(screen.getByRole('header', { name: 'Everything is recovering' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Short balance/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rest today' })).toBeTruthy();
  });
});
