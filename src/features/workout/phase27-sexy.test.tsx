/**
 * Phase 27, B — Sexy: the map lights up muscle by muscle (150 ms, a haptic
 * each, slower for 60+), "reduce motion" shows the final state only, haptics
 * and sounds follow Settings (sounds off by default), identity words instead
 * of guilt, the share card with the week's total, and drawn empty states.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import ProgressScreen from '@/app/(tabs)/progress';
import ShareScreen from '@/app/share';
import { identityKey, workoutsThisWeekDone } from '@/features/home/identity';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import ptBR from '@/i18n/locales/pt-BR.json';

import { devLibrary } from '../exercises/library';

import { LIGHT_STEP_MS, LIGHT_STEP_SENIOR_MS, LightUpBody } from './components/LightUpBody';
import { feel } from './feel';
import { lightOrder } from './lightOrder';
import { useWorkoutStore } from './store';
import type { WorkoutRecord } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const NOW = new Date('2026-09-30T18:00:00');
const realNow = clock.now;
const LIBRARY = devLibrary();
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;
const row = LIBRARY.find((e) => e.pattern === 'horizontal_pull' && e.parts.includes('main'))!;

function finishedWorkout(date: string): WorkoutRecord {
  const moves = [squat, row];
  return {
    id: `w-${date}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:40:00`,
    status: 'done',
    session: {
      items: moves.map((e, n) => ({
        id: `i${n}`,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: e.id,
        targetMuscle: e.muscles.find((m) => m.role === 'primary')!.muscleKey,
        goal: 'grow' as const,
        sets: 2,
        reps: [8, 12] as [number, number],
        restSeconds: 60,
        perSide: false,
        loadHint: null,
        estSeconds: 200,
      })),
      minutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 40,
      notes: [],
    },
    logs: moves.flatMap((e, n) =>
      [1, 2].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: e.id,
        setNo,
        reps: 10,
        loggedAt: `${date}T09:1${setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

let reduceMotion = false;
beforeAll(() => {
  clock.now = () => NOW;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(async () => reduceMotion);
});
afterAll(() => {
  clock.now = realNow;
});
beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion = false;
  (Haptics.selectionAsync as jest.Mock).mockClear();
  (Haptics.impactAsync as jest.Mock).mockClear();
  (createAudioPlayer as jest.Mock).mockClear();
  usePrefsStore.getState().reset();
});
afterEach(() => jest.useRealTimers());

const WORKED = { primary: ['quads', 'glutes'], secondary: ['lats'] };
const ORDER = ['quads', 'glutes', 'lats'];

async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('B1 the map that lights up', () => {
  it('lights the muscles one by one, 150 ms apart, a haptic each, then the big total', async () => {
    await render(<LightUpBody band="adult" sex="f" {...WORKED} order={ORDER} minutes={42} />);
    expect(screen.getByTestId('light-up-running')).toBeTruthy();
    await tick(LIGHT_STEP_MS);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    await tick(LIGHT_STEP_MS);
    await tick(LIGHT_STEP_MS);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('light-up-done')).toBeTruthy();
    expect(screen.getByText('3 muscles · 42 min')).toBeTruthy();
  });

  it('"reduce motion": no animation and no haptics, only the final state', async () => {
    reduceMotion = true;
    await render(<LightUpBody band="adult" sex="f" {...WORKED} order={ORDER} minutes={42} />);
    await tick(0);
    expect(screen.getByTestId('light-up-done')).toBeTruthy();
    expect(screen.queryAllByTestId('light-pulse')).toHaveLength(0);
    await tick(2000);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('60+: slower', async () => {
    await render(
      <LightUpBody band="senior" sex="f" {...WORKED} order={ORDER} minutes={30} senior />,
    );
    for (let i = 0; i < 3; i++) await tick(LIGHT_STEP_MS);
    expect(screen.getByTestId('light-up-running')).toBeTruthy();
    for (let i = 0; i < 3; i++) await tick(LIGHT_STEP_SENIOR_MS);
    expect(screen.getByTestId('light-up-done')).toBeTruthy();
    expect(LIGHT_STEP_SENIOR_MS).toBeGreaterThan(LIGHT_STEP_MS);
  });

  it('the order: the targets first, each muscle once, only muscles on the body', () => {
    const order = lightOrder(finishedWorkout('2026-09-30'), LIBRARY);
    expect(new Set(order).size).toBe(order.length);
    expect(order.slice(0, 2)).toEqual(
      finishedWorkout('2026-09-30').session.items.map((i) => i.targetMuscle),
    );
  });
});

describe('B2 haptics and sounds follow Settings', () => {
  it('haptics on by default, off when turned off', () => {
    feel.set();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    usePrefsStore.getState().set({ haptics: false });
    feel.set();
    feel.light();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('celebration sounds are off by default', () => {
    expect(usePrefsStore.getState().celebrationSounds).toBe(false);
    feel.set();
    feel.finish();
    expect(createAudioPlayer).not.toHaveBeenCalled();
    usePrefsStore.getState().set({ celebrationSounds: true });
    feel.finish();
    expect(createAudioPlayer).toHaveBeenCalled();
  });
});

describe('B4 pride without comparison', () => {
  it('identity words, never guilt', () => {
    expect(identityKey(0)).toBeNull();
    expect(identityKey(1)).toBe('home.identity.one');
    expect(identityKey(3)).toBe('home.identity.many');
    const guilt = /\bmissed\b|\bperdeu\b|\bperdiste\b|don't lose|não perca|no pierdas/i;
    for (const tree of [en, es, ptBR]) {
      const all = JSON.stringify(tree);
      expect(all).not.toMatch(guilt);
    }
  });

  it('the share card: lit map, the week total and the streak; no weight, no measurements', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().update({
        birthMonth: 3,
        birthYear: 1985,
        sex: 'f',
        weightKg: 70,
        onboardingComplete: true,
      });
      useWorkoutStore.getState().reset();
      useWorkoutStore.setState({
        workouts: ['2026-09-28', '2026-09-29', '2026-09-30'].map(finishedWorkout),
      });
    });
    const week = workoutsThisWeekDone(useWorkoutStore.getState().workouts, NOW, 0);
    await render(<ShareScreen />);
    // Phase 28: the week's total and the identity line live on "My week".
    expect(screen.getAllByTestId('share-card-workout').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Week' }));
    const card = screen.getAllByTestId('share-card-week')[0];
    expect(within(card).getByText(`${week} workouts`)).toBeTruthy();
    expect(within(card).getByTestId('card-identity')).toHaveTextContent(
      `You trained ${week} times this week. That's consistency.`,
    );
    expect(screen.queryByText(/\bkg\b|\blb\b|cm\b/)).toBeNull();
  });
});

describe('B3 drawn empty states', () => {
  it('Progress before the first workout: an invitation, not "no data"', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 1985, sex: 'f', onboardingComplete: true });
      useWorkoutStore.getState().reset();
    });
    await render(<ProgressScreen />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      /Your chart starts at your first workout/,
    );
  });
});

describe('B2 a record: a success haptic for adults only', () => {
  const { generateSession } = jest.requireActual('@/features/generator');
  const { inputFromProfile } = jest.requireActual('@/features/generator/fromProfile');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PlayerScreen = require('@/app/workout/[id]/play').default;

  it.each([
    ['adult', 1985, 1],
    ['60+', 1956, 0],
  ])('%s', async (_, birthYear, calls) => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().update({
        birthMonth: 3,
        birthYear,
        sex: 'm',
        mainGoals: ['look'],
        minutes: 40,
        onboardingComplete: true,
        safetyDone: true,
      });
      useOnboardingStore.getState().setLocation('gym');
      useWorkoutStore.getState().reset();
    });
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true);
    const id = useWorkoutStore.getState().create(generateSession(input));
    const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    const main = w.session.items.find(
      (i) => i.role === 'main' && i.part !== 'ramp_up' && byId.get(i.exerciseId)?.loaded,
    )!;
    // A best of 10 kg last week, then everything before this exercise done.
    const past = { ...finishedWorkout('2026-09-23'), id: 'past' };
    past.logs = [
      {
        itemId: 'x',
        exerciseId: main.exerciseId,
        setNo: 1,
        reps: 10,
        load: 10,
        unit: 'kg',
        loggedAt: '2026-09-23T09:10:00',
      },
    ];
    await act(() => {
      useWorkoutStore.setState((st) => ({ workouts: [past, ...st.workouts] }));
      for (const item of w.session.items) {
        if (item.id === main.id) break;
        for (let setNo = 1; setNo <= (item.durationSeconds ? 1 : item.sets); setNo++)
          useWorkoutStore.getState().logSet(id, {
            itemId: item.id,
            exerciseId: item.exerciseId,
            setNo,
            ...(item.durationSeconds ? { seconds: item.durationSeconds } : { reps: 8 }),
          });
      }
    });
    jest.requireMock('expo-router').useLocalSearchParams = () => ({ id });
    (Haptics.notificationAsync as jest.Mock).mockClear();
    await render(<PlayerScreen />);
    const { fireEvent } = jest.requireActual('@testing-library/react-native');
    // Raise the load well past 10 kg.
    for (let i = 0; i < 10; i++)
      await fireEvent.press(screen.getByRole('button', { name: /^Increase Load/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(calls);
  });
});
