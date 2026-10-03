/**
 * Phase 31, package D: the in-workout flow — full-screen warm-up, the set
 * logger ("Done", rest, "Redo", "Customize exercise", "Log all sets"), the
 * next-exercise preview, the final stretch and the end screen; for an adult,
 * a teen (never a load) and 60+. Discard asks first and keeps nothing.
 * Nothing is written over the clip.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import DoneScreen from '@/app/workout/[id]/done';
import ExitScreen from '@/app/workout/[id]/exit';
import PlayerScreen from '@/app/workout/[id]/play';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { useDoseOverrides } from '../workout/doseOverrides';
import { currentStep } from '../workout/flow';
import { useWorkoutStore } from '../workout/store';

jest.setTimeout(60_000);

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
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const LIBRARY = devLibrary();
const base = Date.parse('2026-09-26T12:00:00Z');
let offset = 0;
const store = () => useWorkoutStore.getState();
const current = () => store().workouts.find((w) => w.id === mockParams.id)!;
const tick = () => act(() => new Promise((r) => setTimeout(r, 300)));

beforeEach(() => {
  offset = 0;
  clock.now = () => new Date(base + offset);
  ['push', 'back', 'replace', 'dismissAll'].forEach((k) => mockRouter[k].mockReset());
});

async function setUp(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 40,
      muscleGoals: [{ muscleKey: 'chest', goal: 'grow' }],
      onboardingComplete: true,
      safetyDone: true,
      exercisesPerSession: 2,
    });
    useOnboardingStore.getState().setLocation('gym');
    store().reset();
    useDoseOverrides.getState().reset();
  });
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
  const id = store().create(generateSession(input));
  await act(() => store().start(id));
  mockParams = { id };
}

/** Warm-up or stretch steps: let a countdown run out, else tap the one button. */
async function runGuided(role: 'warmup' | 'cooldown') {
  const labels: string[] = [];
  // A timed finisher runs like the stretch, just before it.
  const roles = role === 'warmup' ? ['warmup'] : ['finisher', 'cooldown'];
  for (let guard = 0; guard < 30; guard++) {
    const step = currentStep(current());
    if (!step || !roles.includes(step.item.role) || step.item.part === 'ramp_up') break;
    expect(screen.getByTestId('guided-step')).toBeTruthy();
    const button = screen.getByTestId('guided-done');
    labels.push(String(button.props.accessibilityLabel));
    const before = current().logs.length;
    offset += 10 * 60 * 1000;
    await tick();
    if (current().logs.length === before) await fireEvent.press(screen.getByTestId('guided-done'));
    expect(current().logs.length).toBe(before + 1);
  }
  return labels;
}

async function runMain(adult: boolean, first: boolean) {
  const start = screen.queryByTestId('start-exercise');
  if (!first) {
    // Between exercises: the preview first.
    expect(screen.getByTestId('next-preview')).toBeTruthy();
    await fireEvent.press(start!);
  }
  if (screen.queryByTestId('ramp-card')) await fireEvent.press(screen.getByTestId('ramp-done'));
  expect(screen.getByTestId('logger-counters')).toBeTruthy();
  expect(!!screen.queryByTestId('counter-volume')).toBe(adult);
  expect(screen.getByTestId('player-title').props.children).toMatch(/^Exercise \d\/2$/);
  const step = currentStep(current())!;
  const item = step.item;
  expect(item.role).toBe('main');

  // "Done": logs the set and opens the rest overlay.
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));
  expect(current().logs.filter((l) => l.itemId === item.id)).toHaveLength(1);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/workout/[id]/rest',
    params: { id: mockParams.id },
  });
  // "Redo": the set comes back.
  const logged = screen.getByTestId('set-logged');
  await fireEvent.press(within(logged).getByText('Redo'));
  expect(current().logs.filter((l) => l.itemId === item.id)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Done with set' }));

  if (!first) {
    // "Customize exercise": one more set, this workout only.
    await fireEvent.press(screen.getByRole('button', { name: 'Customize exercise' }));
    const sheet = screen.getByTestId('customize-sheet');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Increase Sets' }));
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Done' }));
    const now = current().session.items.find((i) => i.id === item.id)!;
    expect(now.sets).toBe(Math.min(6, item.sets + 1));
    expect(useDoseOverrides.getState().overrides).toEqual({});
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Log all sets' }));
  const done = current().session.items.find((i) => i.id === item.id)!;
  expect(current().logs.filter((l) => l.itemId === item.id)).toHaveLength(done.sets);
}

describe.each([
  ['adult', 1985, 'adult'],
  ['teen', new Date().getFullYear() - 15, 'teen'],
  ['60+', 1955, 'senior'],
])('%s: Start → warm-up → 2 exercises → stretch → end', (_, birthYear, mode) => {
  it('runs the whole flow', async () => {
    await setUp(birthYear as number);
    const adult = mode === 'adult';
    const minor = mode === 'teen';
    await render(<PlayerScreen />);

    const warm = await runGuided('warmup');
    expect(warm.length).toBeGreaterThan(0);
    expect(warm.at(-1)).toBe('Finish warm-up');

    await runMain(adult, true);
    if (minor) {
      expect(screen.queryByTestId('current-load')).toBeNull();
      expect(screen.queryByTestId('max-load-chart')).toBeNull();
      expect(screen.queryByText(/\b(kg|lb)\b/)).toBeNull();
    }
    await runMain(adult, false);
    if (minor) expect(current().logs.every((l) => l.load == null)).toBe(true);

    const stretch = await runGuided('cooldown');
    expect(stretch.length).toBeGreaterThan(0);
    expect(stretch.at(-1)).toBe('Finish stretch');
    expect(current().status).toBe('done');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]/done',
      params: { id: mockParams.id },
    });

    await render(<DoneScreen />);
    expect(!!screen.queryByText('Volume')).toBe(adult && current().logs.some((l) => l.load));
    if (minor) expect(screen.queryByText(/\b(kg|lb)\b/)).toBeNull();
    // First workout: no free-account offer yet.
    expect(screen.queryByRole('button', { name: 'Save my progress' })).toBeNull();
  });
});

it('the Exercises list jumps to another exercise without its preview', async () => {
  await setUp(1985);
  const mains = current().session.items.filter((i) => i.role === 'main');
  await act(() => {
    for (const i of current().session.items.filter((x) => x.role === 'warmup'))
      store().skipItem(current().id, i.id);
  });
  await render(<PlayerScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Exercises' }));
  const rows = within(screen.getByTestId('exercises-sheet')).getAllByTestId('exercises-row');
  expect(rows).toHaveLength(mains.length);
  await fireEvent.press(rows[1]);
  expect(current().focus).toBe(mains[1].id);
  expect(currentStep(current())!.item.id).toBe(mains[1].id);
  expect(screen.queryByTestId('next-preview')).toBeNull();
  expect(screen.getByTestId('set-current')).toBeTruthy();
});

it('discard asks first ("Discard and exit" / "Cancel") and keeps nothing', async () => {
  await setUp(1985);
  const main = current().session.items.find((i) => i.role === 'main')!;
  await act(() =>
    store().logSet(current().id, {
      itemId: main.id,
      exerciseId: main.exerciseId,
      setNo: 1,
      reps: 10,
    }),
  );
  await render(<ExitScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(store().workouts).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Discard and exit' }));
  expect(store().workouts).toHaveLength(0);
  expect(store().workouts.flatMap((w) => w.logs)).toHaveLength(0);
});

it('nothing is written over the clip on a guided step', async () => {
  await setUp(1985);
  await render(<PlayerScreen />);
  expect(screen.getByTestId('guided-step')).toBeTruthy();
  const frame = screen.getByTestId('demo-frame');
  expect(within(frame).queryAllByText(/.+/)).toHaveLength(0);
});
