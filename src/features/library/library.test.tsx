/**
 * Improvements v1, package B — Library: browse by body, filters, "Not for
 * you right now", records (Epley), favourites, custom exercises.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import LibraryScreen from '@/app/(tabs)/library';
import ExerciseScreen from '@/app/exercise/[id]';
import CreateExerciseScreen from '@/app/exercise/new';
import {
  generateCustomSession,
  generateSession,
  getAlternatives,
  type GeneratorInput,
} from '@/features/generator';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { libraryView, roleOf } from './browse';
import { canCreateExercise, customToExercise } from './custom';
import { epley, exerciseRecords, visibleRecords } from './performance';
import { useLibraryStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

const LIBRARY = devLibrary();
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const name = (e: { id: string }) => e.id;

beforeAll(() => {
  clock.now = () => new Date('2026-09-30T09:00:00');
});

async function adult(extra: Record<string, unknown> = {}) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1985,
      sex: 'f',
      units: 'imperial',
      minutes: 40,
      daysPerWeek: 3,
      mainGoals: ['strength'],
      muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
      onboardingComplete: true,
      ...extra,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useLibraryStore.getState().reset();
  });
  Object.values(router).forEach((m) => m.mockClear?.());
}

describe('browse (B1, B2)', () => {
  it('a muscle dot lists exercises whose primary muscle is that muscle (chest includes its parts)', () => {
    const view = libraryView(base, { muscle: 'chest' }, name);
    expect(view.safe.length).toBeGreaterThan(5);
    for (const e of view.safe)
      expect(
        e.muscles.some(
          (m) =>
            m.role === 'primary' &&
            ['chest', 'upperChest', 'midChest', 'lowerChest'].includes(m.muscleKey),
        ),
      ).toBe(true);
  });

  it('filters by position, equipment and role', () => {
    const seated = libraryView(base, { position: 'seated_only' }, name).safe;
    expect(seated.every((e) => e.positions.includes('seated_only'))).toBe(true);
    const bodyweight = libraryView(base, { equipment: 'none' }, name).safe;
    expect(bodyweight.every((e) => e.equipment.length === 0)).toBe(true);
    const stretches = libraryView(base, { role: 'stretch' }, name).safe;
    expect(stretches.every((e) => roleOf(e).includes('stretch'))).toBe(true);
    const repair = libraryView(base, { role: 'repair' }, name).safe;
    expect(repair.length).toBeGreaterThan(0);
  });

  it('a knee restriction moves knee moves to "Not for you right now", with the reason', () => {
    const view = libraryView({ ...base, restrictions: ['knee'] }, { muscle: 'quads' }, name);
    expect(view.notForYou.length).toBeGreaterThan(0);
    expect(view.notForYou.every((x) => x.reason === 'restriction' || x.reason === 'pain')).toBe(
      true,
    );
    expect(view.safe.some((e) => e.contraindications.includes('knee'))).toBe(false);
  });

  it('kid-only moves are simply not listed for adults', () => {
    const all = libraryView(base, {}, name);
    expect(
      [...all.safe, ...all.notForYou.map((x) => x.exercise)].some((e) => e.slug.startsWith('kid_')),
    ).toBe(false);
  });
});

describe('records (B3)', () => {
  const w = (id: string, date: string, sets: [number, number][]): WorkoutRecord =>
    ({
      id,
      kind: 'regular',
      status: 'done',
      createdAt: date,
      endedAt: date,
      session: {
        items: [],
        minutes: 45,
        warmupMinutes: 6,
        cooldownMinutes: 5,
        estimatedMinutes: 45,
        notes: [],
      },
      logs: sets.map(([load, reps], i) => ({
        itemId: 'm',
        exerciseId: 'barbell_bench_press',
        setNo: i + 1,
        load,
        reps,
        unit: 'lb',
        loggedAt: date,
      })),
      skipped: [],
      swaps: [],
      pains: [],
    }) as WorkoutRecord;

  it('heaviest, Epley 1RM and best set volume, sessions oldest first', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley(100, 1)).toBe(100);
    const r = exerciseRecords(
      [
        w('a', '2026-09-20T10:00:00Z', [
          [95, 10],
          [100, 8],
        ]),
        w('b', '2026-09-24T10:00:00Z', [[105, 6]]),
      ],
      'barbell_bench_press',
      'lb',
    );
    expect(r.heaviest).toBe(105);
    expect(r.oneRepMax).toBeCloseTo(126.5, 0);
    expect(r.bestSetVolume).toBe(950);
    expect(r.sessions.map((s) => s.workoutId)).toEqual(['a', 'b']);
  });

  it('teens see no 1RM or volume; 60+ only the heaviest', () => {
    expect(visibleRecords('teen')).toEqual([]);
    expect(visibleRecords('senior')).toEqual(['heaviest']);
    expect(visibleRecords('adult')).toHaveLength(3);
  });
});

describe('favourites (B4)', () => {
  it('a starred safe exercise is preferred by the generator and the swap sheet', () => {
    const plain = generateSession({ ...base, exercisesPerSession: 1 });
    const first = plain.items.find((i) => i.role === 'main')!;
    const alts = getAlternatives(plain, first.id, base);
    const star = alts.at(-1)!;
    const starred = generateSession({ ...base, exercisesPerSession: 1, favourites: [star.id] });
    expect(starred.items.find((i) => i.role === 'main')!.exerciseId).toBe(star.id);
    expect(getAlternatives(plain, first.id, { ...base, favourites: [star.id] })[0].id).toBe(
      star.id,
    );
  });

  it('a starred exercise that isn’t safe is never picked', () => {
    const kneeMove = LIBRARY.find(
      (e) =>
        e.contraindications.includes('knee') &&
        e.parts.includes('main') &&
        e.muscles.some((m) => m.muscleKey === 'quads'),
    )!;
    const s = generateSession({
      ...base,
      restrictions: ['knee'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      favourites: [kneeMove.id],
    });
    expect(s.items.some((i) => i.exerciseId === kneeMove.id)).toBe(false);
  });
});

describe('custom exercises (B5)', () => {
  const mine = customToExercise({
    id: 'custom_1',
    name: 'Garage sled push',
    primary: ['quads'],
    secondary: ['glutes'],
    equipment: [],
    joints: ['knee'],
    createdAt: '2026-09-30T09:00:00Z',
  });

  it('adults only', () => {
    expect(canCreateExercise('adult')).toBe(true);
    expect(canCreateExercise('senior')).toBe(true);
    expect(canCreateExercise('teen')).toBe(false);
  });

  it('never auto-programmed; usable in a Custom workout; same restriction check by tagged joints', () => {
    const input = {
      ...base,
      library: [...LIBRARY, mine],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' as const }],
      exercisesPerSession: 8,
    };
    const auto = generateSession(input);
    expect(auto.items.some((i) => i.exerciseId === 'custom_1')).toBe(false);
    const custom = generateCustomSession(input, ['custom_1']);
    expect(custom.items.filter((i) => i.role === 'main').map((i) => i.exerciseId)).toEqual([
      'custom_1',
    ]);
    const withKnee = generateCustomSession({ ...input, restrictions: ['knee'] }, ['custom_1']);
    expect(withKnee.error).toBe('no_main');
  });

  it('Create exercise saves it and shows "Not reviewed by a coach"', async () => {
    await adult();
    await render(<CreateExerciseScreen />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Garage sled push');
    await fireEvent.press(screen.getByRole('button', { name: 'Save exercise' }));
    expect(screen.getByText(/Give it a name and at least one main muscle/)).toBeTruthy();
    expect(useLibraryStore.getState().custom).toHaveLength(0);
    await act(() =>
      useLibraryStore.getState().addCustom({
        id: 'custom_x',
        name: 'Garage sled push',
        primary: ['quads'],
        secondary: [],
        equipment: [],
        joints: [],
        createdAt: '2026-09-30T09:00:00Z',
      }),
    );
    mockParams = { id: 'custom_x' };
    await render(<ExerciseScreen />);
    expect(screen.getByText('Not reviewed by a coach')).toBeTruthy();
  });

  it('a teen cannot create one', async () => {
    await adult({ birthYear: 2011 });
    await render(<CreateExerciseScreen />);
    expect(screen.getByText('Only adults can create exercises.')).toBeTruthy();
  });
});

describe('Library screen and exercise page', () => {
  it('search, star, open; 60+ get area buttons instead of the body map', async () => {
    await adult();
    await render(<LibraryScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Barbell bench press');
    await fireEvent.press(screen.getByRole('button', { name: 'Star Barbell bench press' }));
    expect(useLibraryStore.getState().favourites).toContain('barbell_bench_press');
    await fireEvent.press(screen.getByRole('button', { name: 'Barbell bench press' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/exercise/[id]',
      params: { id: 'barbell_bench_press' },
    });
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeTruthy();
    await adult({ birthYear: 1950 });
    await render(<LibraryScreen />);
    expect(screen.getByRole('button', { name: 'Legs' })).toBeTruthy();
  });

  it('Guidance shows cues, mistakes and muscles worked; Performance shows records', async () => {
    await adult();
    mockParams = { id: 'barbell_bench_press' };
    await render(<ExerciseScreen />);
    expect(screen.getByText('Common mistakes')).toBeTruthy();
    expect(screen.getByText('Muscles worked')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'My history' }));
    expect(screen.getByText('Estimated 1-rep max')).toBeTruthy();
    expect(screen.getByText(/Not done yet/)).toBeTruthy();
  });
});
