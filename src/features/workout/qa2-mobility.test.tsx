/**
 * QA round 2 — decision 1: a short mobility session (~10 min) counts as an
 * active day on the free plan, with no limit; the 3 full workouts a week stay.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutScreen from '@/app/workout/[id]/index';
import { canStartWorkout, workoutsThisWeek } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { devLibrary } from '@/features/exercises/library';
import { generateMobilitySession, generateSession, MOBILITY_MINUTES } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { localDate } from '@/lib/dates';

import { createMobilityWorkout } from './hooks';
import { recentSessions } from './plan';
import { useWorkoutStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
let mockParams: Record<string, string> = {};
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
let now = new Date(2026, 8, 20, 12); // Sunday: a new week (Sunday start)

beforeAll(() => {
  clock.now = () => now;
});

beforeEach(async () => {
  now = new Date(2026, 8, 20, 12);
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'f',
      mainGoals: ['strength'],
      minutes: 40,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('home');
    useWorkoutStore.getState().reset();
    useBillingStore.getState().reset();
  });
  mockParams = {};
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

const input = () => inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;

/** Starts, logs one step and finishes a workout of the given kind today. */
function doWorkout(kind: 'regular' | 'mobility') {
  const store = useWorkoutStore.getState();
  const id =
    kind === 'mobility' ? createMobilityWorkout(input())! : store.create(generateSession(input()));
  const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
  // A main set for a regular workout (it marks the muscles as trained).
  const item = w.session.items.find((i) => i.role === 'main') ?? w.session.items[0];
  useWorkoutStore.getState().start(id);
  useWorkoutStore.getState().logSet(id, {
    itemId: item.id,
    exerciseId: item.exerciseId,
    setNo: 1,
    seconds: 60,
  });
  return useWorkoutStore.getState().finish(id, 'done');
}

describe('the short mobility session', () => {
  it('is about 10 minutes: warm-up first, mobility moves, cool-down last', () => {
    for (const patch of [
      {},
      { position: 'seated_only' as const, mode: 'senior' as const, band: 'senior' as const },
      { mode: 'child' as const, band: 'kid' as const },
    ]) {
      const s = generateMobilitySession({ ...input(), ...patch });
      expect(s.error).toBeUndefined();
      expect(s.items[0].role).toBe('warmup');
      expect(s.items.at(-1)!.role).toBe('cooldown');
      expect(s.minutes).toBe(MOBILITY_MINUTES);
      expect(s.estimatedMinutes).toBeLessThanOrEqual(MOBILITY_MINUTES + 2);
      for (const item of s.items.filter((i) => i.role === 'main')) {
        const e = byId.get(item.exerciseId)!;
        expect(['mobility', 'stretch', 'balance']).toContain(e.pattern);
      }
      expect(s.notes).toEqual([]);
    }
  });

  it('never counts toward the free plan’s 3 workouts a week', () => {
    for (let i = 0; i < 3; i++) doWorkout('regular');
    const workouts = useWorkoutStore.getState().workouts;
    expect(canStartWorkout('free', workouts, now, 0).allowed).toBe(false);
    doWorkout('mobility');
    doWorkout('mobility');
    expect(workoutsThisWeek(useWorkoutStore.getState().workouts, now, 0)).toBe(3);
  });

  it('starts on the free plan even after 3 workouts this week', async () => {
    await act(() => {
      for (let i = 0; i < 3; i++) doWorkout('regular');
    });
    const id = await act(() => createMobilityWorkout(input())!);
    mockParams = { id };
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start with warm-up' }));
    expect(mockRouter.push).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/paywall' }),
    );
    expect(useWorkoutStore.getState().workouts.find((w) => w.id === id)!.status).toBe('active');
  });

  it('free plan: 3 workouts + 4 mobility days reach the 7-day milestone', () => {
    const plan: ('regular' | 'mobility')[] = [
      'regular',
      'mobility',
      'regular',
      'mobility',
      'regular',
      'mobility',
      'mobility',
    ];
    let milestone = false;
    plan.forEach((kind, day) => {
      now = new Date(2026, 8, 20 + day, 12);
      if (kind === 'regular')
        expect(canStartWorkout('free', useWorkoutStore.getState().workouts, now, 0).allowed).toBe(
          true,
        );
      milestone = doWorkout(kind).milestone;
    });
    expect(useWorkoutStore.getState().streak.current).toBe(7);
    expect(milestone).toBe(true);
  });

  it('is offered when everything chosen is still recovering', async () => {
    await act(() => {
      now = new Date(2026, 8, 22, 9);
      doWorkout('regular');
      now = new Date(2026, 8, 22, 18);
      useOnboardingStore.getState().update({
        muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
        exercisesPerSession: 1,
      });
    });
    const s = generateSession({
      ...input(),
      recentSessions: recentSessions(useWorkoutStore.getState().workouts, LIBRARY),
      today: localDate(now),
      now: now.toISOString(),
    });
    if (s.error === 'all_recovering') {
      mockParams = { id: 'unavailable' };
      await render(<WorkoutScreen />);
      expect(screen.getByRole('button', { name: 'Short mobility · 10 min' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Take a rest day' })).toBeTruthy();
    } else {
      // Other groups were still ready: the session trains them, never quads again today.
      expect(s.items.filter((i) => i.role === 'main').some((i) => i.targetMuscle === 'quads')).toBe(
        false,
      );
    }
  });
});
