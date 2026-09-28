/**
 * Phase 14, package D (improvements v1): activity, badges, body, workout
 * preferences, reminders, the streak hint and the owner-profile protection.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProgressScreen from '@/app/(tabs)/progress';
import RemindersScreen from '@/app/settings/reminders';
import WorkoutPrefsScreen from '@/app/settings/workout';
import { useAccountStore } from '@/features/account/store';
import { latest, useBodyStore, whtr } from '@/features/body/store';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { isOwnerProfile, useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { warmupCooldownMinutes } from '@/features/generator/generate';
import { blockReason } from '@/features/generator/filters';
import type { GeneratorInput } from '@/features/generator';
import { fromSeed, type SeedExercise } from '@/features/exercises/library';
import type { Exercise } from '@/features/exercises/types';
import { planNotifications } from '@/features/notifications/plan';
import { GYM_EQUIPMENT_OPTIONS } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { initialPrefs, restFor, usePrefsStore } from '@/features/settings/store';
import { badgeStatus, streakWeeks } from '@/features/workout/badges';
import { initialStreak, showStreakHint } from '@/features/workout/streak';
import { useWorkoutStore } from '@/features/workout/store';
import type { SetLog, WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';

import seed from '../../../supabase/seed/exercises.json';

import { activityTotals, exerciseBest, monthGrid, trainedDays } from './activity';
import { useProgressStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/features/notifications/apply', () => ({
  requestPermission: jest.fn(async () => true),
}));

// Several full-screen renders and seed scans: give slow CI machines room (QA R4 P2: flaky under load).
jest.setTimeout(30_000);

const NOW = new Date('2026-09-28T12:00:00Z');

const log = (exerciseId: string, patch: Partial<SetLog> = {}): SetLog => ({
  itemId: exerciseId,
  exerciseId,
  setNo: 1,
  reps: 10,
  loggedAt: NOW.toISOString(),
  ...patch,
});
const rec = (endedAt: string, logs: SetLog[], patch: Partial<WorkoutRecord> = {}): WorkoutRecord =>
  ({
    id: `w-${endedAt}-${patch.kind ?? 'workout'}`,
    kind: 'workout',
    createdAt: endedAt,
    startedAt: new Date(Date.parse(endedAt) - 45 * 60_000).toISOString(),
    endedAt,
    status: 'done',
    session: { items: [], minutes: 45 },
    logs,
    skipped: [],
    swaps: [],
    pains: [],
    ...patch,
  }) as unknown as WorkoutRecord;

const HISTORY: WorkoutRecord[] = [
  rec('2026-09-27T18:00:00Z', [
    log('bench', { load: 100, unit: 'lb' }),
    log('bench', { load: 110, unit: 'lb', setNo: 2 }),
  ]),
  rec('2026-09-20T18:00:00Z', [log('bench', { load: 95, unit: 'lb' })]),
  rec('2026-09-26T08:00:00Z', [log('cat_cow', { reps: 8 })], { kind: 'mobility' }),
  rec('2026-05-01T18:00:00Z', [log('bench', { load: 80, unit: 'lb' })]),
];

async function adult(birthYear = 1983) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      units: 'imperial',
      heightCm: 170,
      daysPerWeek: 3,
      onboardingComplete: true,
    });
  });
}

beforeAll(() => {
  clock.now = () => NOW;
});
beforeEach(async () => {
  await act(() => {
    useWorkoutStore.getState().reset();
    useProgressStore.getState().reset();
    useBodyStore.getState().reset();
    usePrefsStore.getState().reset();
    useFamilyStore.getState().reset();
    useAccountStore.getState().reset();
  });
});

describe('D1 activity', () => {
  it('totals per range: workouts, hours, volume and mobility apart', () => {
    const week = activityTotals(HISTORY, '7d', NOW, 'lb');
    expect(week).toEqual({ workouts: 1, hours: 0.8, volume: 2100, mobility: 1 });
    expect(activityTotals(HISTORY, '30d', NOW, 'lb').workouts).toBe(2);
    expect(activityTotals(HISTORY, 'all', NOW, 'lb').workouts).toBe(3);
    // Same volume in kg, rounded.
    expect(activityTotals(HISTORY, '7d', NOW, 'kg').volume).toBe(953);
  });

  it('the month calendar marks trained days, weeks from the phone week start', () => {
    expect([...trainedDays(HISTORY, '2026-09')].sort()).toEqual([
      '2026-09-20',
      '2026-09-26',
      '2026-09-27',
    ]);
    const grid = monthGrid('2026-09', 0);
    expect(grid[0]).toEqual([
      null,
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(monthGrid('2026-09', 1)[0][0]).toBeNull();
  });

  it('the exercise graph uses each session’s best load', () => {
    const { points, max } = exerciseBest(HISTORY, 'bench', 'lb');
    expect(points.map((p) => p.best)).toEqual([80, 95, 110]);
    expect(max).toBe(110);
  });

  it('adults get tiles with volume; the Body view is one tap away', async () => {
    await adult();
    await act(() => useWorkoutStore.setState({ workouts: HISTORY }));
    await render(<ProgressScreen />);
    expect(screen.getByTestId('activity-volume')).toBeTruthy();
    expect(screen.getByTestId('activity-mobility')).toBeTruthy();
    expect(screen.getByTestId('trained-2026-09-27')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
    expect(screen.getByText('Waist-to-height ratio')).toBeTruthy();
  });

  it('teens get no volume tile and no Body view', async () => {
    await adult(2011);
    await act(() => useWorkoutStore.setState({ workouts: HISTORY }));
    await render(<ProgressScreen />);
    expect(screen.getByTestId('activity-workouts')).toBeTruthy();
    expect(screen.queryByTestId('activity-volume')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Body' })).toBeNull();
    expect(screen.queryByText('Waist-to-height ratio')).toBeNull();
  });

  it('60+ keep it simple: workouts, hours and the calendar', async () => {
    await adult(1950);
    await act(() => useWorkoutStore.setState({ workouts: HISTORY }));
    await render(<ProgressScreen />);
    expect(screen.getByTestId('activity-hours')).toBeTruthy();
    expect(screen.queryByTestId('activity-volume')).toBeNull();
    expect(screen.queryByTestId('activity-mobility')).toBeNull();
    expect(screen.queryByText('Best load')).toBeNull();
  });
});

describe('D2 badges', () => {
  const lib = [] as Exercise[];
  it('counts consecutive active weeks', () => {
    expect(streakWeeks(HISTORY, NOW, 0)).toBe(2);
  });

  it('volume badges follow the unit; teens never see volume badges', () => {
    const big = [rec('2026-09-27T18:00:00Z', [log('squat', { load: 1000, unit: 'lb', reps: 10 })])];
    const adultBadges = badgeStatus(big, initialStreak(), lib, NOW, { mode: 'adult', unit: 'lb' });
    expect(adultBadges.find((b) => b.key === 'volume_1')?.earned).toBe(true);
    const teen = badgeStatus(big, initialStreak(), lib, NOW, { mode: 'teen', unit: 'lb' });
    expect(teen.some((b) => b.key.startsWith('volume'))).toBe(false);
    expect(teen.some((b) => b.key === 'first_workout')).toBe(true);
  });

  it('shows the streak hint the day after a workout', () => {
    const streak = { ...initialStreak(), current: 3, lastActive: '2026-09-27' };
    expect(showStreakHint(streak, '2026-09-28')).toBe(true);
    expect(showStreakHint(streak, '2026-09-27')).toBe(false);
    expect(showStreakHint({ ...streak, current: 0 }, '2026-09-28')).toBe(false);
  });
});

describe('D3 body (adults)', () => {
  it('latest value per measurement across check-ins and entries; WHtR first', () => {
    const now = latest(
      [{ date: '2026-09-20', waistCm: 82, armCm: 30 }],
      [{ takenAt: '2026-09-01', waistCm: 85, weightKg: 70 }],
    );
    expect(now).toEqual({ waistCm: 82, armCm: 30, weightKg: 70 });
    expect(whtr(85, 170)).toBe(0.5);
    expect(whtr(undefined, 170)).toBeNull();
  });

  it('saves tape measurements in cm from inches', async () => {
    await adult();
    await render(<ProgressScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
    await fireEvent.changeText(screen.getByLabelText('Waist (in)'), '33.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));
    const [entry] = useBodyStore.getState().entries;
    expect(entry.waistCm).toBeCloseTo(85.1, 1);
    expect(screen.getByText('0.50')).toBeTruthy();
  });
});

describe('D4 preferences', () => {
  const main = { role: 'main', reps: [8, 12] as [number, number], restSeconds: 75 };
  it('rest defaults replace the timer start only for main work', () => {
    expect(restFor(main, initialPrefs())).toBe(75);
    expect(restFor(main, { restStrength: 120, restHold: 30 })).toBe(120);
    expect(
      restFor(
        { role: 'main', holdSeconds: [20, 30], restSeconds: 40 },
        { restStrength: 120, restHold: 45 },
      ),
    ).toBe(45);
    expect(restFor({ role: 'warmup', restSeconds: 0 }, { restStrength: 120, restHold: 45 })).toBe(
      0,
    );
  });

  it('a short warm-up keeps both warm-up and cool-down', () => {
    for (const mode of ['teen', 'adult', 'senior'] as const) {
      const std = warmupCooldownMinutes(mode, 45);
      const short = warmupCooldownMinutes(mode, 45, true);
      expect(short.warmup).toBeGreaterThan(0);
      expect(short.cooldown).toBeGreaterThan(0);
      expect(short.warmup).toBeLessThanOrEqual(std.warmup);
      expect(warmupCooldownMinutes(mode, 15, true).warmup).toBeGreaterThan(0);
    }
  });

  it('"new to training" keeps harder moves out', () => {
    const library = (seed.exercises as SeedExercise[]).map(fromSeed);
    const input: GeneratorInput = {
      library,
      includeDrafts: true,
      mode: 'adult',
      band: 'adult',
      position: 'standing',
      location: 'gym',
      equipment: GYM_EQUIPMENT_OPTIONS,
      minutes: 45,
      mainGoals: ['strength'],
      muscleGoals: [],
      exercisesPerSession: 5,
      setsPerExercise: 3,
      painAreas: [],
      conditions: [],
      restrictions: [],
    };
    const count = (experience: GeneratorInput['experience']) =>
      library.filter((e) => blockReason(e, { ...input, experience }) === null).length;
    const hardOnly = library.filter(
      (e) =>
        blockReason(e, { ...input, experience: 'experienced' }) === null &&
        blockReason(e, { ...input, experience: 'new' }) === 'level',
    );
    expect(hardOnly.length).toBeGreaterThan(0);
    expect(count('new')).toBeLessThan(count('some'));
    expect(count('some')).toBeLessThanOrEqual(count('experienced'));
  });

  it('the settings screen stores rest, voice, warm-up and experience', async () => {
    await adult();
    await render(<WorkoutPrefsScreen />);
    await fireEvent.press(screen.getByText('90 s'));
    await fireEvent.press(screen.getByText('Short'));
    await fireEvent.press(screen.getByText('New to training'));
    await fireEvent(screen.getByLabelText('Voice cues'), 'valueChange', true);
    await fireEvent.press(screen.getByText('kg · cm'));
    expect(usePrefsStore.getState()).toMatchObject({
      restStrength: 90,
      warmup: 'short',
      experience: 'new',
      voice: true,
    });
    expect(useOnboardingStore.getState().units).toBe('metric');
  });

  it('60+ get the longer strength rests only', async () => {
    await adult(1950);
    await render(<WorkoutPrefsScreen />);
    expect(screen.queryByText('60 s')).toBeNull();
    expect(screen.getAllByText('120 s').length).toBeGreaterThan(0);
  });

  it('reminder days chosen in Settings drive the notifications', async () => {
    await adult();
    await render(<RemindersScreen />);
    await fireEvent(screen.getByLabelText('Workout reminders'), 'valueChange', true);
    const days = screen.getAllByLabelText(/, reminder$/);
    expect(days).toHaveLength(7);
    await fireEvent.press(days[6]); // Saturday on
    const prefs = useAccountStore.getState().notifications;
    expect(prefs.reminders).toBe(true);
    expect(prefs.reminderDays).toContain(6);
    const plan = planNotifications({
      prefs,
      daysPerWeek: 3,
      now: NOW,
    } as Parameters<typeof planNotifications>[0]);
    const weekdays = plan
      .filter((p) => p.kind === 'reminder')
      .map((p) => ('weekday' in p ? p.weekday : 0));
    expect(weekdays).toContain(7);
  });
});

describe('profile-kind protection (QA round 3, with Phase 14)', () => {
  it('trusts a "self" profile only when its id matches the secure record', () => {
    const self = { id: 'a', kind: 'self' } as Parameters<typeof isOwnerProfile>[0];
    expect(isOwnerProfile(self, 'a')).toBe(true);
    expect(isOwnerProfile(self, 'b')).toBe(false);
    expect(isOwnerProfile(self, null)).toBe(true);
  });

  it('a member profile edited to "self" still meets the parent gate', async () => {
    const owner = await act(() => ensureSelfProfile());
    expect(useOwnerIdentityStore.getState().ownerId).toBe(owner.id);
    await act(() =>
      useFamilyStore.setState((s) => ({
        profiles: [...s.profiles, { ...owner, id: 'teen-1', kind: 'self', name: 'Kid' }],
        activeId: 'teen-1',
      })),
    );
    let access = '';
    function Probe() {
      access = useOwnerAccess();
      return null;
    }
    await render(<Probe />);
    expect(access).toBe('gate');
  });

  it('keeps preferences and body entries per profile', async () => {
    const owner = await act(() => ensureSelfProfile());
    await act(() => {
      usePrefsStore.getState().set({ restStrength: 120 });
      useBodyStore.getState().add({ date: '2026-09-28', waistCm: 80 });
      useFamilyStore.setState((s) => ({
        profiles: [...s.profiles, { ...owner, id: 'adult-2', kind: 'parent', name: 'B' }],
      }));
    });
    await act(() => switchProfile('adult-2'));
    expect(usePrefsStore.getState().restStrength).toBeNull();
    expect(useBodyStore.getState().entries).toEqual([]);
    await act(() => switchProfile(owner.id));
    expect(usePrefsStore.getState().restStrength).toBe(120);
    expect(useBodyStore.getState().entries).toHaveLength(1);
  });
});
