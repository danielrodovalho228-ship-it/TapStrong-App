/**
 * Phase 27, A — Simple: the tap audit as tests (open → first set in at most
 * 3 taps with a plan, in adult, teen and 60+ mode; a swap in at most 2; the
 * end of a workout needs no tap), one main button per screen, and plain
 * words (no jargon, button labels of at most 4 words).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';

import HomeScreen from '@/app/(tabs)/home';
import DoneScreen from '@/app/workout/[id]/done';
import WorkoutScreen from '@/app/workout/[id]/index';
import PlayerScreen from '@/app/workout/[id]/play';
import RestScreen from '@/app/workout/[id]/rest';
import { useAccountStore } from '@/features/account/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { currentStep, stepKind } from '@/features/workout/flow';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { colors } from '@/theme';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import ptBR from '@/i18n/locales/pt-BR.json';

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

let nowMs = Date.parse('2026-09-30T09:00:00');
const realNow = clock.now;

beforeAll(() => {
  clock.now = () => new Date(nowMs);
});
afterAll(() => {
  clock.now = realNow;
});
beforeEach(() => {
  jest.useFakeTimers();
  nowMs = Date.parse('2026-09-30T09:00:00');
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
  mockParams = {};
});
afterEach(() => {
  jest.useRealTimers();
});

async function profile(birthYear: number) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 35,
      daysPerWeek: 3,
      onboardingComplete: true,
      safetyDone: true,
      position: 'standing',
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useRestrictionsStore.getState().reset();
  });
}

const workout = () => useWorkoutStore.getState().workouts.find((w) => w.id === mockParams.id)!;

/** Lets the countdowns run: the clock and the timers move together. */
async function wait(seconds: number) {
  nowMs += seconds * 1000;
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

describe('A1 tap audit: open → first set', () => {
  it.each([
    ['adult', 1985],
    ['teen', 2011],
    ['60+', 1956],
  ])('%s: at most 3 taps from Home to the first logged set', async (_, year) => {
    await profile(year);
    let taps = 0;
    await render(<HomeScreen />);
    taps += 1;
    await fireEvent.press(screen.getByTestId('start-hero'));
    const call = mockRouter.push.mock.calls.at(-1)![0];
    expect(call.pathname).toBe('/workout/[id]/play');
    mockParams = { id: call.params.id };
    expect(workout().status).toBe('active');

    await render(<PlayerScreen />);
    // Warm-up countdowns start and end by themselves; sets need one "Done".
    for (let guard = 0; guard < 20; guard++) {
      if (workout().logs.some((l) => l.reps != null)) break;
      const step = currentStep(workout())!;
      if (stepKind(step.item) === 'timed') {
        await wait(step.item.durationSeconds ?? 0);
      } else {
        taps += 1;
        await fireEvent.press(screen.getByRole('button', { name: /^(Done with set|Done · .*|Done)$/ }));
      }
    }
    expect(workout().logs.some((l) => l.reps != null)).toBe(true);
    expect(taps).toBeLessThanOrEqual(3);
  });

  it('a swap takes at most 2 taps', async () => {
    await profile(1985);
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('start-hero'));
    mockParams = { id: mockRouter.push.mock.calls.at(-1)![0].params.id };
    await render(<PlayerScreen />);
    const before = currentStep(workout())!.item.exerciseId;
    await fireEvent.press(screen.getByRole('link', { name: 'Swap' }));
    await fireEvent.press(screen.getAllByRole('button', { name: /^Replace with / })[0]);
    expect(currentStep(workout())!.item.exerciseId).not.toBe(before);
  });

  it('the end of the workout needs no tap: the cool-down runs and ends it', async () => {
    await profile(1985);
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('start-hero'));
    mockParams = { id: mockRouter.push.mock.calls.at(-1)![0].params.id };
    const w = workout();
    await act(() => {
      for (const item of w.session.items) {
        if (item.role === 'cooldown') continue;
        for (let setNo = 1; setNo <= (item.durationSeconds ? 1 : item.sets); setNo++)
          useWorkoutStore.getState().logSet(w.id, {
            itemId: item.id,
            exerciseId: item.exerciseId,
            setNo,
            ...(item.durationSeconds ? { seconds: item.durationSeconds } : { reps: 10 }),
          });
      }
    });
    await render(<PlayerScreen />);
    // Every cool-down step (countdowns and stretch holds) ends by itself.
    for (let guard = 0; guard < 20 && workout().status === 'active'; guard++) {
      const step = currentStep(workout());
      if (!step) break;
      await wait(step.item.durationSeconds ?? (step.item.holdSeconds?.[0] ?? 30) * 2);
    }
    expect(workout().status).toBe('done');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/workout/[id]/done',
      params: { id: w.id },
    });
  });
});

/** Filled buttons on screen (coral or teal fill): Button primary / accent / teal, and the hero. */
function mainButtons(): number {
  const fills = [colors.accent, colors.accentPressed, colors.teal];
  return screen
    .queryAllByRole('button')
    .filter((b) => fills.includes(StyleSheet.flatten(b.props.style)?.backgroundColor as string))
    .length;
}

describe('A3 one decision per screen: at most one main button', () => {
  it.each([
    ['adult', 1985],
    ['teen', 2011],
    ['60+', 1956],
  ])('%s Home', async (_, year) => {
    await profile(year);
    await render(<HomeScreen />);
    expect(mainButtons()).toBe(1);
  });

  it('the preview, the player, rest and the end screen', async () => {
    await profile(1985);
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('start-hero'));
    mockParams = { id: mockRouter.push.mock.calls.at(-1)![0].params.id };
    await render(<WorkoutScreen />);
    expect(mainButtons()).toBeLessThanOrEqual(1);
    await render(<PlayerScreen />);
    expect(mainButtons()).toBeLessThanOrEqual(1);
    await render(<RestScreen />);
    expect(mainButtons()).toBeLessThanOrEqual(1);
    await act(() => {
      useWorkoutStore.getState().finish(mockParams.id, 'done');
    });
    for (const saved of [false, true]) {
      await act(() => useAccountStore.setState({ saved }));
      await render(<DoneScreen />);
      expect(mainButtons()).toBeLessThanOrEqual(1);
    }
  });
});

describe('A4 plain words', () => {
  type Tree = { [k: string]: string | Tree };
  const strings = (tree: Tree, path = ''): [string, string][] =>
    Object.entries(tree).flatMap(([k, v]) =>
      typeof v === 'string' ? [[`${path}${k}`, v] as [string, string]] : strings(v, `${path}${k}.`),
    );
  const LOCALES = { en, es, 'pt-BR': ptBR } as unknown as Record<string, Tree>;

  it('no jargon in visible text: RPE, deload, hypertrophy, unilateral', () => {
    const banned = /\bRPE\b|deload|hypertroph|hipertrof|unilateral/i;
    for (const [locale, tree] of Object.entries(LOCALES)) {
      const hits = strings(tree).filter(([, v]) => banned.test(v));
      expect({ locale, hits }).toEqual({ locale, hits: [] });
    }
  });

  /**
   * Buttons read in 4 words or fewer. Exceptions: the store badge wording
   * required by Apple and Google, and the development-only simulator.
   */
  const EXCEPTIONS = ['family.getIos', 'family.getAndroid', 'billing.dev.charge'];

  it('button labels have at most 4 words in every language', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.tsx') && !path.includes('.test.')) files.push(path);
      }
    };
    walk(join(__dirname, '..', '..'));
    const keys = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const button of source.matchAll(/<Button\b([\s\S]*?)\/>/g))
        for (const [, key] of button[1].matchAll(/label=\{t\(\s*'([^']+)'/g)) keys.add(key);
    }
    expect(keys.size).toBeGreaterThan(100);
    const words = (text: string) =>
      text
        .replace(/\{\{[^}]+\}\}/g, 'X')
        .split(/\s+/)
        .filter((w) => w && !['·', '-', '—', '+', '&'].includes(w)).length;
    const lookup = (tree: Tree, key: string): string | undefined => {
      let node: string | Tree | undefined = tree;
      for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
      if (typeof node === 'string') return node;
      if (node && typeof node === 'object') return (node.other ?? node.one) as string;
      const plural = lookup(tree, `${key}_other`);
      return plural;
    };
    const long: string[] = [];
    for (const key of keys) {
      if (EXCEPTIONS.includes(key)) continue;
      for (const [locale, tree] of Object.entries(LOCALES)) {
        const text = key.includes('_') ? lookup(tree, key) : lookup(tree, key);
        if (text && words(text) > 4) long.push(`${locale} ${key}: ${text}`);
      }
    }
    expect(long).toEqual([]);
  });
});
