import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import HomeScreen from '@/app/(tabs)/home';
import ProgressScreen from '@/app/(tabs)/progress';
import BeforeAfterScreen from '@/app/before-after';
import { devLibrary } from '@/features/exercises/library';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { isChildProfile } from '@/lib/monitoring';

import { dayPart, lastWorkout } from './summary';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/features/progress/photos', () => ({
  takePhoto: jest.fn(),
  deletePhotoFile: jest.fn(),
  deleteAllPhotos: jest.fn(),
}));

const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

function finished(): WorkoutRecord {
  const input = inputFromProfile(useOnboardingStore.getState(), devLibrary(), true)!;
  const session = generateSession(input);
  const main = session.items.filter((i) => i.role === 'main');
  return {
    id: 'w1',
    kind: 'regular',
    createdAt: '2026-09-22T09:00:00.000Z',
    startedAt: '2026-09-22T09:00:00.000Z',
    endedAt: '2026-09-22T09:11:00.000Z',
    status: 'done',
    session,
    logs: main.map((i) => ({
      itemId: i.id,
      exerciseId: i.exerciseId,
      setNo: 1,
      reps: 8,
      loggedAt: '2026-09-22T09:05:00.000Z',
    })),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T09:00:00');
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1955,
      sex: 'm',
      daysPerWeek: 3,
      minutes: 15,
      location: 'home',
      position: 'with_support',
      onboardingComplete: true,
    });
    useWorkoutStore.getState().reset();
    useProgressStore.getState().reset();
  });
  Object.values(router).forEach((m) => m.mockClear?.());
  (Speech.speak as jest.Mock).mockClear();
});

describe('60+ home (mockup 23)', () => {
  it('shows one big Start, progress, and supported options', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Good morning')).toBeTruthy();
    expect(screen.getByText(/^Today · \d+ minutes · supported options$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    // No body-map or camera entry points from the 60+ home.
    expect(screen.queryByText('Open full body map')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pick something else' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'My progress' }));
    expect(router.push).toHaveBeenCalledWith('/progress');
  });

  it('summarizes the last workout and reads it aloud', async () => {
    await act(() => useWorkoutStore.setState({ workouts: [finished()] }));
    await render(<HomeScreen />);
    expect(screen.getByText(/^You did \d+ exercises? in 11 min\. It's saved\.$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Read it to me' }));
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.stringContaining("It's saved."),
      expect.objectContaining({ language: 'en' }),
    );
    expect(screen.getByRole('button', { name: 'Stop reading' })).toBeTruthy();
  });
});

describe('60+ before & after photos', () => {
  it('are off by default and turned on from Progress', async () => {
    await render(<ProgressScreen />);
    expect(screen.queryByRole('button', { name: 'Before & after photos' })).toBeNull();
    await render(<BeforeAfterScreen />);
    expect(screen.getByText('redirect:/progress')).toBeTruthy();

    await render(<ProgressScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Before & after photos' }));
    expect(useProgressStore.getState().seniorPhotos).toBe(true);
    expect(screen.getByRole('button', { name: 'Before & after photos' })).toBeTruthy();
    await render(<BeforeAfterScreen />);
    expect(screen.queryByText('redirect:/progress')).toBeNull();
  });
});

describe('helpers', () => {
  it('finds the last finished workout', () => {
    expect(lastWorkout([])).toBeNull();
    const w = finished();
    expect(lastWorkout([w, { ...w, id: 'w2', status: 'active' }])).toMatchObject({
      endedAt: w.endedAt,
      minutes: 11,
    });
  });

  it('greets by part of the day', () => {
    expect(dayPart(new Date(2026, 8, 28, 8))).toBe('morning');
    expect(dayPart(new Date(2026, 8, 28, 14))).toBe('afternoon');
    expect(dayPart(new Date(2026, 8, 28, 20))).toBe('evening');
  });

  it('never tracks a child profile', async () => {
    expect(isChildProfile()).toBe(false);
    await act(() => useOnboardingStore.getState().update({ birthYear: 2016 }));
    expect(isChildProfile()).toBe(true);
  });
});
