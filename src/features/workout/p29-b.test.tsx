/**
 * Phase 29, package B (learned from Gymverse, adapted to our ages): Home
 * preview with posters, the week on top, "How to" / "My history", the
 * per-set suggestion (one tap logs it; minors see no load), warm-up sets as
 * one card, the workout menu, big plan cards, Home / Gym equipment and the
 * 180° body button. Rest −15 / +15 is in screens.test.tsx.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import BodyScreen from '@/app/body-goals';
import HomeScreen from '@/app/(tabs)/home';
import ExercisePage from '@/app/exercise/[id]';
import PlayerScreen from '@/app/workout/[id]/play';
import EquipmentScreen from '@/app/settings/equipment';
import { PlansBrowser } from '@/features/program/components/PlansBrowser';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { useWorkoutStore } from './store';
import type { WorkoutRecord } from './types';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const press = LIBRARY.find((e) => e.loaded && e.parts.includes('main') && e.dose === 'reps')!;
const NOW = new Date('2026-10-01T18:00:00');

beforeAll(() => {
  clock.now = () => NOW;
});

async function as(birthYear: number, extra: Record<string, unknown> = {}) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 30,
      muscleGoals: [{ muscleKey: 'glutes', goal: 'firm' }],
      onboardingComplete: true,
      units: 'metric',
      ...extra,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
  });
}

const item = (part: 'main' | 'ramp_up', sets: number) => ({
  id: part === 'main' ? 'm' : 'r',
  role: part === 'main' ? ('main' as const) : ('warmup' as const),
  part,
  exerciseId: press.id,
  targetMuscle: press.muscles[0].muscleKey,
  goal: 'grow' as const,
  sets,
  reps: [8, 12] as [number, number],
  restSeconds: 60,
  perSide: false,
  loadHint: part === 'ramp_up' ? ('ramp' as const) : null,
  estSeconds: 200,
});

function record(id: string, opts: { done?: boolean; ramp?: boolean; date?: string } = {}) {
  const date = opts.date ?? '2026-10-01';
  const w: WorkoutRecord = {
    id,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: opts.done ? `${date}T09:40:00` : undefined,
    status: opts.done ? 'done' : 'active',
    session: {
      items: [...(opts.ramp ? [item('ramp_up', 2)] : []), item('main', 3)],
      minutes: 30,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: opts.done
      ? [
          {
            itemId: 'm',
            exerciseId: press.id,
            setNo: 1,
            reps: 12,
            load: 20,
            unit: 'kg',
            loggedAt: `${date}T09:10:00`,
          },
          {
            itemId: 'm',
            exerciseId: press.id,
            setNo: 2,
            reps: 12,
            load: 20,
            unit: 'kg',
            loggedAt: `${date}T09:12:00`,
          },
        ]
      : [],
    skipped: [],
    swaps: [],
    pains: [],
  };
  return w;
}

async function player(workouts: WorkoutRecord[], id: string) {
  await act(() => useWorkoutStore.setState({ workouts }));
  mockParams = { id };
  await render(<PlayerScreen />);
}

describe('B1–B2: Home', () => {
  it('the week on top, then the workout with posters, "N sets × 8–12" and swap', async () => {
    await as(1990);
    await render(<HomeScreen />);
    // Tree order: the week strip comes before the big Start.
    const order: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return;
      const node = n as { props?: { testID?: string }; children?: unknown[] };
      if (node.props?.testID) order.push(node.props.testID);
      for (const c of node.children ?? []) walk(c);
    };
    walk(screen.root);
    expect(order.indexOf('week-strip')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('week-strip')).toBeLessThan(order.indexOf('start-hero'));
    // Phase 31, B: big cards with the clip or poster, "N sets × 8–12 reps" and swap.
    expect(screen.getAllByTestId('plan-card').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByTestId('plan-card-badge')
        .some((b) => /^\d+ sets × \d+(–\d+)? reps/.test(String(b.props.children))),
    ).toBe(true);
    expect(screen.getAllByRole('button', { name: /^Swap / }).length).toBeGreaterThan(0);
  });
});

describe('B3: exercise page', () => {
  it('"Guidance" and "Performance"; a teen sees reps, never a load', async () => {
    await as(new Date().getFullYear() - 15);
    await act(() =>
      useWorkoutStore.setState({ workouts: [record('past', { done: true, date: '2026-09-28' })] }),
    );
    mockParams = { id: press.id };
    await render(<ExercisePage />);
    expect(screen.getByRole('radio', { name: 'Guidance' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Performance' }));
    expect(screen.queryByText(/20 kg/)).toBeNull();
    expect(screen.getByText(/12 reps/)).toBeTruthy();
  });
});

describe('B4: the per-set suggestion', () => {
  // Phase 31, D: the current set row carries the suggestion and last time.
  it('adult: "Suggested", last time, the max-load chart; one tap logs it', async () => {
    await as(1990);
    await player([record('past', { done: true, date: '2026-09-28' }), record('now')], 'now');
    const row = screen.getByTestId('set-current');
    expect(within(row).getByText(/^Suggested \d+(\.\d+)? kg \(last 20 kg\)$/)).toBeTruthy();
    expect(within(row).getByText('8–12 reps (last 12) · now 8')).toBeTruthy();
    expect(screen.getByTestId('max-load-chart')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
    const log = useWorkoutStore.getState().workouts.find((w) => w.id === 'now')!.logs[0];
    expect(log.load).toBeGreaterThan(0);
    expect(log.reps).toBe(8);
  });

  it('teen: reps only, no load, no record', async () => {
    await as(new Date().getFullYear() - 15);
    await player([record('past', { done: true, date: '2026-09-28' }), record('now')], 'now');
    expect(screen.queryByTestId('current-load')).toBeNull();
    expect(screen.queryByTestId('max-load-chart')).toBeNull();
    expect(screen.queryByText(/\bkg\b/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
    const log = useWorkoutStore.getState().workouts.find((w) => w.id === 'now')!.logs[0];
    expect(log.load).toBeUndefined();
  });
});

describe('B5: warm-up sets', () => {
  it('one card "10 reps empty bar · 5 light"; Done logs them, Skip leaves them', async () => {
    await as(1990);
    await player([record('now', { ramp: true })], 'now');
    expect(screen.getByTestId('ramp-card')).toBeTruthy();
    // One part per warm-up set the plan has (2 for adults, SPEC §8).
    expect(screen.getByText(/^10 reps (empty bar|very light) · 5 light$/)).toBeTruthy();
    // No set is current while the warm-up sets are open.
    expect(screen.queryByTestId('set-current')).toBeNull();
    await fireEvent.press(screen.getByTestId('ramp-done'));
    const w = useWorkoutStore.getState().workouts[0];
    expect(w.logs.filter((l) => l.itemId === 'r').map((l) => l.reps)).toEqual([10, 5]);

    await player([record('again', { ramp: true })], 'again');
    await fireEvent.press(screen.getByText('Skip'));
    expect(useWorkoutStore.getState().workouts[0].skipped).toContain('r');
  });
});

describe('B7: the workout menu', () => {
  it('"⋯" opens the menu', async () => {
    await as(1990);
    await player([record('now')], 'now');
    await fireEvent.press(screen.getByRole('button', { name: 'Workout menu' }));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith({
      pathname: '/workout/[id]/exit',
      params: { id: 'now' },
    });
  });
});

describe('B8–B10', () => {
  it('plans are big cards with a picture', async () => {
    await as(1990);
    await render(<PlansBrowser mode="adult" />);
    expect(screen.getAllByTestId('plan-card').length).toBeGreaterThan(3);
  });

  it('equipment: Home first, then Gym, each item once', async () => {
    await as(1990);
    await render(<EquipmentScreen />);
    expect(screen.getByRole('header', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Gym' })).toBeTruthy();
    expect(
      within(screen.getByTestId('equipment-home')).getByRole('switch', { name: 'Chair' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('switch', { name: 'Chair' })).toHaveLength(1);
  });

  it('the body turns around with one tap', async () => {
    await as(1990);
    await render(<BodyScreen />);
    expect(useOnboardingStore.getState().bodyView).toBe('front');
    await fireEvent.press(screen.getByRole('button', { name: 'Turn the body around' }));
    expect(useOnboardingStore.getState().bodyView).toBe('back');
  });
});
