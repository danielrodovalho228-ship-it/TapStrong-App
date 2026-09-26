import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import DoneScreen from '@/app/workout/[id]/done';
import ExitScreen from '@/app/workout/[id]/exit';
import WorkoutScreen from '@/app/workout/[id]/index';
import PainScreen from '@/app/workout/[id]/pain';
import PlayerScreen from '@/app/workout/[id]/play';
import RestScreen from '@/app/workout/[id]/rest';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { SwapSheet } from './components/SwapSheet';
import { allSteps, currentStep } from './flow';
import { useWorkoutStore } from './store';

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

const mockRouter = jest.requireMock('expo-router').router as Record<
  'push' | 'back' | 'replace' | 'dismissAll',
  jest.Mock
>;

const events: { event: string; props?: object }[] = [];
setAnalyticsSink((event, props) => events.push({ event, props }));

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const profile = () => useOnboardingStore.getState();
const workouts = () => useWorkoutStore.getState();
const current = () => workouts().workouts.find((w) => w.id === mockParams.id)!;

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

async function setUp(place: 'gym' | 'home' = 'gym', exercisesPerSession = 3) {
  await act(() => {
    profile().reset();
    profile().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'm',
      mainGoals: ['look'],
      minutes: 40,
      muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      onboardingComplete: true,
      exercisesPerSession,
    });
    profile().setLocation(place);
    workouts().reset();
    useRestrictionsStore.getState().reset();
  });
  const input = inputFromProfile(profile(), LIBRARY, true)!;
  const id = workouts().create(generateSession(input));
  mockParams = { id };
  return input;
}

beforeEach(() => {
  [mockRouter.push, mockRouter.back, mockRouter.replace, mockRouter.dismissAll].forEach((fn) =>
    fn.mockReset(),
  );
  events.length = 0;
});

describe('Workout list (mockup 10)', () => {
  it('shows warm-up first, the exercises, cool-down last and the draft badge', async () => {
    await setUp();
    await render(<WorkoutScreen />);
    expect(screen.getByText(/^Warm-up · \d+ min$/)).toBeTruthy();
    expect(screen.getByText(/^Cool-down · \d+ min$/)).toBeTruthy();
    expect(screen.getByText(/draft exercises, not reviewed yet/)).toBeTruthy();
    expect(screen.getByText('Upper chest · Grow')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start with warm-up' }));
    expect(current().status).toBe('active');
    expect(events.map((e) => e.event)).toContain('workout_started');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/workout/[id]/play',
      params: { id: mockParams.id },
    });
  });

  it('swaps an exercise in place, logs the reason, and undoes it', async () => {
    await setUp();
    const before = current().session;
    const target = before.items.find((i) => i.role === 'main')!;
    const name = profileName(target.exerciseId);
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: `Swap ${name}` }));

    const replaceButtons = screen.getAllByRole('button', { name: /^Replace with / });
    expect(replaceButtons.length).toBeGreaterThan(0);
    expect(replaceButtons.length).toBeLessThanOrEqual(5);
    await fireEvent.press(replaceButtons[0]);

    const after = current().session;
    expect(after.items).toHaveLength(before.items.length);
    const index = before.items.findIndex((i) => i.id === target.id);
    expect(after.items[index].id).toBe(target.id);
    expect(after.items[index].exerciseId).not.toBe(target.exerciseId);
    expect(current().swaps).toHaveLength(1);
    expect(events).toContainEqual({ event: 'exercise_swapped', props: { reason: 'user_choice' } });

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(current().session).toEqual(before);
    expect(current().swaps).toHaveLength(0);
  });

  it('"Machine is taken" never offers the same machine', async () => {
    await setUp('gym');
    await render(<WorkoutScreen />);
    const button = screen.queryByRole('button', { name: 'Machine is taken' });
    expect(button).toBeTruthy();
    await fireEvent.press(button!);
    const picker = screen.queryByText('Which machine is taken?');
    if (picker) {
      const [first] = within(screen.getByText('Which machine is taken?').parent!.parent!.parent!)
        .getAllByRole('button')
        .filter((b) => b.props.accessibilityLabel !== 'Close');
      await fireEvent.press(first);
    }
    const machineItem = current().session.items.find((i) =>
      byId.get(i.exerciseId)?.equipment.some((q) => q === 'machines' || q === 'cables'),
    )!;
    const busy: string[] = byId
      .get(machineItem.exerciseId)!
      .equipment.filter((q) => q === 'machines' || q === 'cables');
    for (const b of screen.queryAllByRole('button', { name: /^Replace with / })) {
      const label = String(b.props.accessibilityLabel).replace('Replace with ', '');
      const option = LIBRARY.find((e) => profileName(e.id) === label)!;
      expect(option.equipment.some((q) => busy.includes(q))).toBe(false);
    }
  });

  it('"Only 15 min today" keeps warm-up and cool-down', async () => {
    await setUp();
    await render(<WorkoutScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Only 15 min today' }));
    const { session } = current();
    expect(session.estimatedMinutes).toBeLessThanOrEqual(15);
    expect(session.items[0].role).toBe('warmup');
    expect(session.items.at(-1)!.role).toBe('cooldown');
  });

  it('shows the empty state when no safe alternative exists', async () => {
    const input = await setUp();
    const w = current();
    const item = w.session.items.find((i) => i.role === 'main')!;
    // A library holding only today's exercises has nothing to swap in.
    const only = LIBRARY.filter((e) => w.session.items.some((i) => i.exerciseId === e.id));
    await render(
      <SwapSheet
        visible
        workout={w}
        itemId={item.id}
        reason="user_choice"
        input={{ ...input, library: only }}
        byId={byId}
        onPickItem={jest.fn()}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
      />,
    );
    expect(
      screen.getByText('No safe alternative for this muscle with your equipment.'),
    ).toBeTruthy();
  });

  it('without a workout it says the library is under review', async () => {
    await setUp();
    mockParams = { id: 'unavailable' };
    await render(<WorkoutScreen />);
    expect(screen.getByText(/being reviewed by a certified coach/)).toBeTruthy();
  });
});

describe('Player (mockup 11) and rest (mockup 12)', () => {
  it('runs warm-up steps, then logs a set and opens the rest screen', async () => {
    await setUp('home'); // bodyweight day: warm-up steps can end at once
    await render(<PlayerScreen />);
    // Finish every warm-up step.
    while (currentStep(current())!.item.role === 'warmup') {
      const before = current().logs.length;
      const done = screen.queryByRole('button', { name: 'Done' });
      if (done) await fireEvent.press(done);
      else await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
      expect(current().logs.length).toBe(before + 1);
    }
    const step = currentStep(current())!;
    expect(step.item.role).toBe('main');
    expect(screen.getByText(`Set 1 of ${step.item.sets}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Increase Reps/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
    const log = current().logs.at(-1)!;
    expect(log.reps).toBe(
      (step.item.reps?.[0] ?? step.item.holdSeconds![0]) + (step.item.reps ? 1 : 5),
    );
    expect(events.map((e) => e.event)).toContain('set_logged');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/workout/[id]/rest',
      params: { id: mockParams.id },
    });

    await render(<RestScreen />);
    expect(screen.getByText('Logged')).toBeTruthy();
    expect(screen.getByText('Up next')).toBeTruthy();
    const total = step.item.restSeconds;
    const fmt = (s: number) => `of ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    expect(screen.getByText(fmt(total))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '+30 s' }));
    expect(screen.getByText(fmt(total + 30))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('asks before skipping the cool-down, then completes the workout', async () => {
    await setUp('home');
    const w = current();
    // Log everything before the cool-down.
    await act(() => {
      for (const s of allSteps(w.session.items).filter((x) => x.item.role !== 'cooldown')) {
        workouts().logSet(w.id, {
          itemId: s.item.id,
          exerciseId: s.item.exerciseId,
          setNo: s.setNo,
          reps: 10,
        });
      }
    });
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip cool-down' }));
    expect(screen.getByText(/Skip cool-down\? It helps you recover/)).toBeTruthy();
    const skipButtons = screen.getAllByRole('button', { name: 'Skip cool-down' });
    await fireEvent.press(skipButtons.at(-1)!);
    expect(current().status).toBe('done');
    expect(workouts().streak.current).toBe(1);
    expect(events.map((e) => e.event)).toContain('workout_completed');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]/done',
      params: { id: w.id },
    });
  });
});

describe('Pain swap (mockup 21)', () => {
  async function toMainStep() {
    const w = current();
    await act(() => {
      for (const s of allSteps(w.session.items).filter((x) => x.item.role === 'warmup')) {
        workouts().logSet(w.id, {
          itemId: s.item.id,
          exerciseId: s.item.exerciseId,
          setNo: s.setNo,
          seconds: 60,
        });
      }
    });
    return currentStep(current())!;
  }

  it('sharp pain stops the workout and saves the restriction', async () => {
    await setUp();
    await toMainStep();
    await render(<PainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Right shoulder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sharp' }));
    expect(screen.getByText('Stop for today')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept swap' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'End workout' }));
    expect(current().status).toBe('partial');
    expect(current().pains[0]).toMatchObject({
      area: 'shoulder',
      side: 'right',
      type: 'sharp',
      action: 'stopped',
    });
    expect(useRestrictionsStore.getState().items).toMatchObject([
      { area: 'shoulder', side: 'right', source: 'pain_report', active: true },
    ]);
    // Only the pain type reaches analytics, never the area.
    expect(events).toContainEqual({ event: 'pain_reported', props: { type: 'sharp' } });
    expect(JSON.stringify(events)).not.toContain('shoulder');
  });

  it('dull pain offers a safe swap for the same muscle that spares the area', async () => {
    await setUp();
    const step = await toMainStep();
    await render(<PainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Knee' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dull / pinch' }));
    expect(screen.getByRole('checkbox', { name: 'Save "Knee" to My restrictions' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept swap' }));
    const swapped = current().session.items.find((i) => i.id === step.item.id)!;
    const next = byId.get(swapped.exerciseId)!;
    expect(swapped.exerciseId).not.toBe(step.item.exerciseId);
    expect(next.contraindications).not.toContain('knee');
    expect(next.muscles.some((m) => m.muscleKey === 'upperChest' && m.role === 'primary')).toBe(
      true,
    );
    expect(current().swaps.at(-1)!.reason).toBe('pain');
    expect(useRestrictionsStore.getState().items).toMatchObject([{ area: 'knee' }]);
    expect(events).toContainEqual({ event: 'exercise_swapped', props: { reason: 'pain' } });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('with no safe swap, the exercise can be skipped (and the restriction is optional)', async () => {
    await setUp();
    const step = await toMainStep();
    await render(<PainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Right shoulder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dull / pinch' }));
    // Every chest press in the library loads the shoulder.
    expect(
      screen.getByText('No safe alternative for this muscle with your equipment.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: /Right shoulder/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip this exercise' }));
    expect(current().skipped).toContain(step.item.id);
    expect(current().pains.at(-1)!.action).toBe('skipped');
    expect(useRestrictionsStore.getState().items).toHaveLength(0);
  });

  it('saved restrictions filter the next workout', async () => {
    await setUp();
    await act(() =>
      useRestrictionsStore
        .getState()
        .add({ area: 'shoulder', side: 'right', source: 'pain_report' }),
    );
    await render(<HomeScreen />);
    await act(() => workouts().reset());
    await fireEvent.press(screen.getByRole('button', { name: /^Start · 40 min/ }));
    const [next] = workouts().workouts;
    for (const item of next.session.items) {
      expect(byId.get(item.exerciseId)!.contraindications).not.toContain('shoulder');
    }
  });
});

describe('Exit (mockup 13) and Done (mockup 14)', () => {
  it('"Save & end" keeps the logged sets and counts the streak', async () => {
    await setUp();
    const w = current();
    const main = w.session.items.find((i) => i.role === 'main')!;
    await act(() =>
      workouts().logSet(w.id, { itemId: main.id, exerciseId: main.exerciseId, setNo: 1, reps: 10 }),
    );
    await render(<ExitScreen />);
    const total = w.session.items.filter((i) => i.role === 'main').reduce((n, i) => n + i.sets, 0);
    expect(screen.getByText(new RegExp(`You've done 1 of ${total} sets`))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save & end' }));
    expect(current().status).toBe('partial');
    expect(workouts().streak.current).toBe(1);
    expect(events.map((e) => e.event)).toContain('workout_ended_early');
  });

  it('"Discard workout" deletes it', async () => {
    await setUp();
    await render(<ExitScreen />);
    expect(screen.queryByRole('button', { name: 'Save & end' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
    expect(workouts().workouts).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });

  it('celebrates, shows the streak and suggests the untrained group', async () => {
    // One exercise: chest only, so legs stay untrained.
    await setUp('gym', 1);
    const w = current();
    const main = w.session.items.filter((i) => i.role === 'main');
    await act(() => {
      for (const m of main)
        workouts().logSet(w.id, { itemId: m.id, exerciseId: m.exerciseId, setNo: 1, reps: 10 });
      workouts().finish(w.id, 'partial');
    });
    await render(<DoneScreen />);
    expect(screen.getByText('First one done!')).toBeTruthy();
    expect(screen.getByText('Day 1 streak')).toBeTruthy();
    expect(screen.getByText('Main target today')).toBeTruthy();

    const later = screen.queryByRole('button', { name: /next time$/ });
    expect(later).toBeTruthy();
    await fireEvent.press(later!);
    expect(workouts().nextFocus).toBe('legs');
    expect(screen.getByText(/go first next time/)).toBeTruthy();
  });

  it('"Add 10 min" creates a short finisher with warm-up and cool-down', async () => {
    // One exercise: chest only, so legs stay untrained.
    await setUp('gym', 1);
    const w = current();
    const main = w.session.items.filter((i) => i.role === 'main');
    await act(() => {
      for (const m of main)
        workouts().logSet(w.id, { itemId: m.id, exerciseId: m.exerciseId, setNo: 1, reps: 10 });
      workouts().finish(w.id, 'partial');
    });
    await render(<DoneScreen />);
    const add = screen.queryByRole('button', { name: 'Add 10 min' });
    expect(add).toBeTruthy();
    await fireEvent.press(add!);
    const finisher = workouts().workouts.find((x) => x.kind === 'finisher')!;
    expect(finisher.session.items[0].role).toBe('warmup');
    expect(finisher.session.items.at(-1)!.role).toBe('cooldown');
    expect(finisher.session.estimatedMinutes).toBeLessThanOrEqual(10);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]',
      params: { id: finisher.id },
    });
  });
});

function profileName(exerciseId: string): string {
  // en names from the i18n bundle, via the key on the exercise.
  const en = require('@/i18n/locales/en.json') as { exercises: Record<string, { name: string }> };
  return en.exercises[byId.get(exerciseId)!.slug].name;
}
