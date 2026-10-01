/**
 * Phase 29, package A (the phone test): the media frame, the fallback with
 * the muscles lit, the swap sheet rows, the calm "I feel pain", reminders on
 * the web. The first-workout clip list is first-workout-media.test.ts; the
 * first-workout "Finish strong" rule and the notification warning are in
 * screens.test.tsx and account/screens.test.tsx.
 */
import '@/i18n';

import { readFileSync } from 'fs';
import { join } from 'path';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import PlayerScreen from '@/app/workout/[id]/play';
import RemindersScreen from '@/app/settings/reminders';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { clock } from '@/lib/clock';
import { PALETTES } from '@/theme';

import { devLibrary } from '../exercises/library';

import { DemoLoop, demoFrameSize } from './components/Media';
import { levelOf, SwapSheet } from './components/SwapSheet';
import { useWorkoutStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/features/notifications/apply', () => ({
  remindersAvailable: false,
  requestPermission: async () => false,
}));
jest.mock('@/features/workout/components/DemoVideo', () => ({
  DemoVideo: () => {
    const { View } = jest.requireActual('react-native');
    return <View testID="demo-video" />;
  },
}));

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const workouts = () => useWorkoutStore.getState();

beforeAll(() => {
  clock.now = () => new Date('2026-10-01T12:00:00Z');
});

async function setUp(sex: 'f' | 'm' = 'f') {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      sex,
      mainGoals: ['look'],
      minutes: 30,
      muscleGoals: [{ muscleKey: 'glutes', goal: 'firm' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('home');
    workouts().reset();
    useRestrictionsStore.getState().reset();
  });
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
  const id = workouts().create(generateSession(input));
  mockParams = { id };
  return { input, workout: workouts().workouts.find((w) => w.id === id)! };
}

type Node = { type?: unknown; props?: { testID?: string }; children?: unknown[] };
/** Every text inside the media frame, except the dev-only prototype badge. */
function textsOnMedia() {
  const found: Node[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as Node;
    if (node.props?.testID === 'demo-prototype-badge') return;
    if (node.type === 'Text') found.push(node);
    for (const c of node.children ?? []) walk(c);
  };
  walk(screen.getByTestId('demo-frame'));
  return found;
}

describe('A1: our clips, per sex, for the beginner workout', () => {
  const manifest = readFileSync(join(__dirname, '../../../assets/prototype/videos.js'), 'utf8');
  const qc = JSON.parse(
    readFileSync(join(__dirname, '../../../assets/prototype/qc.json'), 'utf8'),
  ) as { otherSex: Record<string, string> };
  // Beginner exercises with both clips; the last three use the man's clip for
  // the woman too (qc.json otherSex, Daniel, Oct 1).
  const BEGINNER = [
    'sit_to_stand',
    'glute_bridge',
    'rx_high_box_squat',
    'dead_bug',
    'bodyweight_squat',
    'chair_supported_squat',
    'incline_plank',
    'wall_push_up',
    'low_step_up',
    'standing_supported_bird_dog',
  ];
  it.each(BEGINNER)('%s: the woman sees the woman, the man the man', (slug) => {
    const line = manifest.split('\n').find((l) => l.startsWith(`  "${slug}":`));
    expect(line).toBeDefined();
    for (const sex of ['f', 'm'] as const) {
      const from = qc.otherSex[`${slug}.${sex}`] ? (sex === 'f' ? 'm' : 'f') : sex;
      expect(line).toContain(`${sex}: require("./${slug}.${from}.mp4")`);
      expect(line).toContain(`${sex}: require("./posters/${slug}.${from}.webp")`);
    }
  });
});

describe('A1–A2: the media frame', () => {
  it('is 4:5, at most a third of the screen, and never wider than the screen', () => {
    const phone = demoFrameSize({ width: 390, height: 844 });
    expect(phone.height).toBeLessThanOrEqual(844 * 0.32);
    expect(phone.width / phone.height).toBeCloseTo(0.8, 1);
    const narrow = demoFrameSize({ width: 320, height: 900 });
    expect(narrow.width).toBeLessThanOrEqual(320 - 32);
  });

  it('a clip: rounded, clipped frame at the top, no text on it but the dev badge', async () => {
    await render(<DemoLoop video={1} poster={2} chips={[{ label: 'Glutes', strong: true }]} />);
    const frame = screen.getByTestId('demo-frame');
    const style = StyleSheet.flatten(frame.props.style);
    expect(style.overflow).toBe('hidden');
    expect(style.borderRadius).toBeGreaterThan(0);
    expect(style.position).not.toBe('absolute');
    expect(within(frame).getByTestId('demo-video')).toBeTruthy();
    expect(textsOnMedia()).toHaveLength(0);
    // The chips sit below the frame.
    expect(within(frame).queryByText('GLUTES')).toBeNull();
    expect(screen.getByText('Glutes')).toBeTruthy();
  });

  it('no clip: the body with the muscles lit and "Demo coming soon" below, no licensed-library text', async () => {
    await render(
      <DemoLoop
        chips={[]}
        muscles={{ band: 'adult', sex: 'f', primary: ['glutes'], secondary: ['hamstrings'] }}
      />,
    );
    expect(within(screen.getByTestId('demo-frame')).getByTestId('demo-muscle-map')).toBeTruthy();
    expect(textsOnMedia()).toHaveLength(0);
    expect(screen.getByText('Demo coming soon')).toBeTruthy();
    expect(screen.queryByText(/licensed/)).toBeNull();
  });

  it('the player: no text over the media, on every step of the first workout', async () => {
    const { workout } = await setUp('m');
    await render(<PlayerScreen />);
    expect(screen.getByTestId('demo-frame')).toBeTruthy();
    expect(textsOnMedia()).toHaveLength(0);
    expect(workout.session.items[0].role).toBe('warmup');
  });
});

describe('A3: the swap sheet', () => {
  it('one light row per option, tap the row to swap, no big Replace buttons', async () => {
    const { input, workout } = await setUp();
    const main = workout.session.items.find((i) => i.role === 'main')!;
    const onSwapped = jest.fn();
    await render(
      <SwapSheet
        visible
        workout={workout}
        itemId={main.id}
        reason="user_choice"
        input={input}
        byId={byId}
        onPickItem={() => undefined}
        onClose={() => undefined}
        onSwapped={onSwapped}
      />,
    );
    expect(screen.getByText('Same muscle · easier / same / harder')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
    const rows = screen.getAllByTestId('swap-option');
    expect(rows.length).toBeGreaterThan(0);
    await fireEvent.press(rows[0]);
    expect(onSwapped).toHaveBeenCalledTimes(1);
  });

  it('groups by level against the exercise it replaces', () => {
    const [a, b] = LIBRARY;
    expect(levelOf({ ...a, level: 1 }, { ...b, level: 2 })).toBe('easier');
    expect(levelOf({ ...a, level: 2 }, { ...b, level: 2 })).toBe('same');
    expect(levelOf({ ...a, level: 3 }, { ...b, level: 2 })).toBe('harder');
  });
});

describe('A6: details', () => {
  it('"I feel pain": secondary text color with an icon, not red capitals', async () => {
    await setUp();
    await render(<PlayerScreen />);
    const pain = screen.getByTestId('pain-button');
    const label = within(pain).getByText('I feel pain');
    const color = StyleSheet.flatten(label.props.style).color;
    expect(color).toBe(PALETTES.light.mutedStrong);
    expect(color).not.toBe(PALETTES.light.danger);
  });
});

describe('A5: reminders on the web', () => {
  it('no switches and no warning: "available in the app"', async () => {
    await render(<RemindersScreen />);
    expect(screen.getByTestId('reminders-app-only')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/Turn them on in your phone's settings/)).toBeNull();
  });
});
