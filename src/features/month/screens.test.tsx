/**
 * Phase 26 — screens: the full "Month closed" screen opens once, "Skip"
 * leaves a Home card for 7 days, the next-month choice, the light "resume"
 * card, age rules, auto-apply + undo, never during a workout, and the
 * optional notification.
 */
import '@/i18n';

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import MonthScreen from '@/app/month';
import MonthsScreen from '@/app/months';
import type { Exercise } from '@/features/exercises/types';
import { useFamilyStore } from '@/features/family/store';
import { planNotifications } from '@/features/notifications/plan';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgramStore } from '@/features/program/store';
import { useProgressStore } from '@/features/progress/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { autoChooseIfPending } from './apply';
import { MonthAutoNotice } from './components/MonthAutoNotice';
import { MonthHomeCard } from './components/MonthHomeCard';
import { useMonthStore } from './store';
import { useMonthClose } from './useMonthClose';

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
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const primary = (e: Exercise) => e.muscles.find((m) => m.role === 'primary')?.muscleKey ?? null;
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.loaded && e.parts.includes('main'))!;
const bench = LIBRARY.find(
  (e) => e.pattern === 'horizontal_push' && e.loaded && e.parts.includes('main') && !e.isolation,
)!;
const NOW = new Date('2026-09-30T09:00:00');
const realNow = clock.now;

function workout(date: string, i: number): WorkoutRecord {
  const moves = [
    { id: squat.id, load: 60 + i * 2.5 },
    { id: bench.id, load: 40 },
  ];
  return {
    id: `w-${date}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:45:00`,
    status: 'done',
    session: {
      items: moves.map((m, n) => ({
        id: `i${n}`,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: m.id,
        targetMuscle: primary(byId.get(m.id)!),
        goal: 'grow' as const,
        sets: 3,
        reps: [8, 12] as [number, number],
        restSeconds: 90,
        perSide: false,
        loadHint: null,
        estSeconds: 300,
      })),
      minutes: 45,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 45,
      notes: [],
    },
    logs: moves.flatMap((m, n) =>
      [1, 2, 3].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: m.id,
        setNo,
        reps: 10,
        load: m.load,
        unit: 'kg' as const,
        loggedAt: `${date}T09:${10 + setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

const SEPT = ['01', '04', '08', '11', '15', '18', '22', '25'].map((d) => `2026-09-${d}`);

async function profile(birthYear = 1985, count = 8) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      daysPerWeek: 3,
      minutes: 40,
      mainGoals: ['look'],
      muscleGoals: [
        { muscleKey: 'quads', goal: 'grow' },
        { muscleKey: 'hamstrings', goal: 'grow' },
      ],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useWorkoutStore.setState({ workouts: SEPT.slice(0, count).map(workout) });
    useProgramStore.getState().reset();
    useFamilyStore.getState().reset();
    useProgressStore.getState().reset();
    useMonthStore.getState().reset();
  });
  Object.values(router).forEach((m) => m.mockClear?.());
}

/** What Home does on open: close the block if it is due (and open /month once). */
async function openHome() {
  await renderHook(() => {
    const library = useExerciseLibrary();
    useMonthClose(useGeneratorInput(library), library);
  });
}

beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});
beforeEach(() => {
  mockParams = {};
});

describe('appearance', () => {
  it('the first open after the block opens the full screen once', async () => {
    await profile();
    await render(<HomeScreen />);
    expect(router.push).toHaveBeenCalledWith('/month');
    expect(useMonthStore.getState().offer).not.toBeNull();
    // The next open: no full screen again (once per block).
    router.push.mockClear();
    await openHome();
    expect(router.push).not.toHaveBeenCalledWith('/month');
  });

  it('skipped: a Home card instead, for 7 days', async () => {
    await profile();
    await openHome();
    await render(<HomeScreen />);
    expect(screen.getByTestId('month-home-card')).toBeTruthy();
  });

  it('the card goes away after 7 days', async () => {
    await profile();
    await openHome();
    clock.now = () => new Date('2026-10-08T09:00:00');
    try {
      await render(<MonthHomeCard />);
      expect(screen.queryByTestId('month-home-card')).toBeNull();
    } finally {
      clock.now = () => NOW;
    }
  });

  it('never in the middle of a workout', async () => {
    await profile();
    await act(() =>
      useWorkoutStore.setState((s) => ({
        workouts: [...s.workouts, { ...workout('2026-09-30', 9), id: 'live', status: 'active' }],
      })),
    );
    await render(<HomeScreen />);
    expect(router.push).not.toHaveBeenCalledWith('/month');
  });

  it('fewer than 4 workouts: no summary, a light "Shall we pick it up again?" card', async () => {
    await profile(1985, 3);
    await render(<HomeScreen />);
    expect(router.push).not.toHaveBeenCalledWith('/month');
    expect(screen.getByTestId('month-resume-card')).toBeTruthy();
    expect(screen.getByText('Shall we pick it up again?')).toBeTruthy();
  });

  it('the optional notification follows the reminder setting, no new permission', () => {
    const base = {
      daysPerWeek: 3,
      streak: 0,
      lastActive: null,
      now: NOW,
      monthClosesOn: '2026-10-27',
    };
    const on = planNotifications({
      ...base,
      prefs: {
        reminders: true,
        reminderTime: '18:30',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
    });
    expect(on.find((p) => p.kind === 'month_closed')).toMatchObject({ id: 'month-closed' });
    const off = planNotifications({
      ...base,
      prefs: {
        reminders: false,
        reminderTime: '18:30',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
    });
    expect(off.some((p) => p.kind === 'month_closed')).toBe(false);
  });
});

describe('the Month closed screen', () => {
  const open = async (birthYear = 1985) => {
    await profile(birthYear);
    await openHome();
    await render(<MonthScreen />);
  };

  it('summary, "Skip" always there, and one tap starts next month', async () => {
    await open();
    expect(screen.getByText('1 month complete!')).toBeTruthy();
    expect(screen.getByText('Workouts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(screen.getByTestId('month-preview')).toBeTruthy();
    expect(screen.getByText(/Keeps:/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep progressing (recommended)' }));
    const s = useMonthStore.getState();
    expect(s.offer).toBeNull();
    expect(s.history[0].choice).toBe('continue');
    expect(s.plan?.next).toContain(squat.id);
    expect(router.replace).toHaveBeenCalledWith('/home');
  });

  it('adults see strength, records and measurements; tapping a muscle shows its sets', async () => {
    await open();
    expect(screen.getByText('Strength')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add measurements' })).toBeTruthy();
    expect(screen.queryByText('Your habit')).toBeNull();
    // Tap a muscle: this month's sets (the first block has no "last month").
    await fireEvent.press(screen.getByRole('button', { name: 'Quads' }));
    expect(screen.getByTestId('month-muscle-compare')).toHaveTextContent(
      /^Quads: \d+ sets this month$/,
    );
  });

  it('teens: days, sets, the map and the habit; no weights, records, measurements or photos', async () => {
    await open(2011);
    expect(screen.getByText('Your habit')).toBeTruthy();
    expect(screen.queryByText('Strength')).toBeNull();
    expect(screen.queryByText('Records this month')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Progress photos' })).toBeNull();
  });

  it('60+: no measurements; photos only once turned on', async () => {
    await open(1960);
    expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Progress photos' })).toBeNull();
    await act(() => useProgressStore.getState().setSeniorPhotos(true));
    expect(screen.getByRole('button', { name: 'Progress photos' })).toBeTruthy();
  });

  it('"Repeat the same" keeps every move', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat the same' }));
    expect(useMonthStore.getState().plan?.avoid).toEqual([]);
  });

  it('"Choose on the body" opens the body map with the suggested focus', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose on the body' }));
    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/body' }));
    expect(useMonthStore.getState().history[0].choice).toBe('body');
  });

  it('Progress > Months lists the past months', async () => {
    await profile();
    await openHome();
    await render(<MonthsScreen />);
    expect(screen.getByRole('button', { name: /8 workouts/ })).toBeTruthy();
  });
});

describe('auto-apply and undo on the first workout', () => {
  it('"Renewed N exercises · Undo" brings back last month', async () => {
    await profile();
    await openHome();
    const before = useMonthStore.getState().plan;
    await act(() => {
      autoChooseIfPending(NOW);
    });
    const onUndone = jest.fn();
    await render(<MonthAutoNotice onUndone={onUndone} />);
    expect(screen.getByTestId('month-auto-notice')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Undo' }));
    expect(onUndone).toHaveBeenCalled();
    expect(useMonthStore.getState().plan).toEqual(before);
    expect(useMonthStore.getState().autoNotice).toBeNull();
  });
});
