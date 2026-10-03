/**
 * Phase 31, package B: the Workout tab as "My plan" — the header, the week,
 * "Week N/M · Build", today's split, "N exercises · N min" (never kcal), big
 * cards with "N sets × 8–12 reps × load" (load for adults only), warm-up and
 * final stretch cards, the fixed START WORKOUT button, swap right on the
 * plan, and the rest day with "Stretch now".
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import { GYM_EQUIPMENT_OPTIONS } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { generateSession } from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import { useWorkoutStore } from '../workout/store';
import type { WorkoutRecord } from '../workout/types';

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
const LIBRARY = devLibrary();
const NOW = new Date('2026-10-01T18:00:00');
beforeAll(() => {
  clock.now = () => NOW;
});
beforeEach(() => Object.values(router).forEach((m) => m.mockClear?.()));

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
  });
}

/** A finished workout on a day that logged 20 kg on every loaded main exercise. */
function history(day = '2026-09-17', id = 'past'): WorkoutRecord {
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true, {
    today: day,
    now: NOW.toISOString(),
  })!;
  const loaded = LIBRARY.filter((e) => e.loaded && e.parts.includes('main'));
  return {
    id,
    kind: 'regular',
    createdAt: `${day}T08:00:00`,
    startedAt: `${day}T08:00:00`,
    endedAt: `${day}T08:40:00`,
    status: 'done',
    // One main item per loaded exercise, so every log counts as history.
    session: {
      ...generateSession(input),
      items: loaded.map((e) => ({
        id: e.id,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: e.id,
        targetMuscle: e.muscles[0]?.muscleKey ?? null,
        goal: 'grow' as const,
        sets: 2,
        reps: [8, 12] as [number, number],
        restSeconds: 60,
        perSide: false,
        loadHint: null,
        estSeconds: 120,
      })),
    },
    logs: loaded.flatMap((e) =>
      [1, 2].map((setNo) => ({
        itemId: e.id,
        exerciseId: e.id,
        setNo,
        reps: 10,
        load: 20,
        unit: 'kg' as const,
        loggedAt: `${day}T08:${10 + setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

describe('My plan', () => {
  it('header, week, "Week N/M · Build", today, summary without kcal, cards and START WORKOUT', async () => {
    await as(1990);
    await render(<HomeScreen />);
    expect(screen.getByRole('header', { name: 'My plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Equipment filters' })).toBeTruthy();
    expect(screen.getByTestId('week-strip')).toBeTruthy();
    expect(screen.getByText(/^Week \d\/\d · (Build|Light week)$/)).toBeTruthy();
    expect(screen.getByRole('header', { name: "Today's workout" })).toBeTruthy();
    expect(screen.getByTestId('plan-summary').props.children).toMatch(/^\d+ exercises? · \d+ min$/);
    expect(screen.queryByText(/kcal/)).toBeNull();
    expect(screen.getByTestId('plan-warmup')).toBeTruthy();
    expect(screen.getByTestId('plan-cooldown')).toBeTruthy();
    const cards = screen.getAllByTestId('plan-card');
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) expect(within(card).getByTestId('plan-card-badge')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'START WORKOUT' }));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/workout/[id]/play' }),
    );
  });

  it('the load shows for adults, never for minors', async () => {
    for (const [birthYear, adult] of [
      [1990, true],
      [new Date().getFullYear() - 15, false],
    ] as const) {
      await as(birthYear);
      // Today's workout already planned, its main exercises done at 20 kg before.
      const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true, {
        today: '2026-10-01',
        now: NOW.toISOString(),
      })!;
      const session = generateSession(input);
      const mains = session.items.filter((i) => i.role === 'main');
      const past = history();
      const today: WorkoutRecord = {
        ...past,
        id: 'planned',
        status: 'planned',
        createdAt: '2026-10-01T07:00:00',
        startedAt: undefined,
        endedAt: undefined,
        session,
        logs: [],
      };
      past.session = { ...session };
      past.logs = mains.map((i, n) => ({
        itemId: i.id,
        exerciseId: i.exerciseId,
        setNo: 1,
        reps: 10,
        load: 20,
        unit: 'kg' as const,
        loggedAt: `2026-09-17T08:${10 + n}:00`,
      }));
      await act(() => useWorkoutStore.setState({ workouts: [past, today] }));
      await render(<HomeScreen />);
      const badges = screen.getAllByTestId('plan-card-badge').map((b) => String(b.props.children));
      expect(badges.length).toBe(mains.length);
      if (adult) expect(badges.some((b) => / × \d+(\.\d+)? kg$/.test(b))).toBe(true);
      else expect(badges.some((b) => /kg|lb/.test(b))).toBe(false);
    }
  });

  it('swap opens the sheet right on the plan and never adds an exercise', async () => {
    await as(1990);
    await render(<HomeScreen />);
    const before = screen.getAllByTestId('plan-card').length;
    await fireEvent.press(screen.getAllByTestId('plan-card-swap')[0]);
    const stored = useWorkoutStore.getState().workouts;
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('planned');
    expect(screen.getAllByTestId('swap-option').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByTestId('swap-option')[0]);
    expect(useWorkoutStore.getState().workouts[0].swaps).toHaveLength(1);
    expect(screen.getAllByTestId('plan-card')).toHaveLength(before);
  });

  it('rest day: the recommendation and "Stretch now", no workout start', async () => {
    await as(1990);
    await act(() =>
      useWorkoutStore.setState({
        workouts: [history('2026-10-01', 'today')],
      }),
    );
    await render(<HomeScreen />);
    expect(screen.getByText(/5–10 minutes of stretching/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'START WORKOUT' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Stretch now' }));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/workout/[id]' }),
    );
  });
});
