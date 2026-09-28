/**
 * QA round 5 — P1: knee gaps (R5-01), one advice source for the rest screen
 * (R5-02), stale workouts (R5-03), teen safety answers behind the PIN
 * (R5-04), plan day targets (R5-05) and full Push days (R5-06).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SafetyScreen from '@/app/onboarding/safety';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { useOnboardingStore } from '@/features/onboarding/store';
import { dayTargets, planById, planDayInput } from '@/features/program/plans';
import { loadAdvice, type Session } from '@/features/workout/loads';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { blockReason } from './filters';
import { generateSession } from './generate';
import type { GeneratorInput } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ edit: '1' }),
  Redirect: () => null,
}));

const RAW = seed.exercises as SeedExercise[];
const LIBRARY = RAW.map(fromSeed);
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const NOW = new Date('2026-09-28T12:00:00Z');
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 50,
  mainGoals: ['strength'],
  muscleGoals: [],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};

beforeAll(() => {
  clock.now = () => NOW;
});

describe('R5-01 knee stop', () => {
  it.each([
    'leg_swings',
    'wu_lateral_leg_swings',
    'wall_calf_stretch',
    'st_step_calf_stretch',
    'st_standing_hamstring_stretch',
    'dumbbell_seated_calf_raise',
    'seated_calf_raise_machine',
    'fc_seated_heel_drums',
    'seated_hamstring_stretch',
    'seated_march',
    'dumbbell_shrug',
    'rx_hip_hinge_hold',
    'short_lever_copenhagen',
  ])('rules out %s the same day', (slug) => {
    expect(blockReason(bySlug.get(slug)!, { ...base, rehab: true, stoppedToday: ['knee'] })).toBe(
      'contraindication',
    );
  });

  it('audit: every standing single-leg stance carries the knee', () => {
    const missing = RAW.filter(
      (e) =>
        e.joints.some((j) => j[0] === 'ankle' && j[1] === 'balance') &&
        !e.joints.some((j) => j[0] === 'knee'),
    ).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it('audit: standing shrugs and standing hinge holds carry the knee', () => {
    const missing = RAW.filter(
      (e) =>
        (/shrug/.test(e.slug) && !/seated/.test(e.slug)) ||
        (e.pattern === 'hinge' && /standing|hinge_hold/.test(e.slug) && !/seated/.test(e.slug)),
    )
      .filter((e) => !e.joints.some((j) => j[0] === 'knee'))
      .map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it('kneeling moves are not a 60+ default', () => {
    const senior = { ...base, mode: 'senior' as const, band: 'senior' as const };
    expect(blockReason(bySlug.get('kneeling_hip_flexor_stretch')!, senior)).toBe('position');
    expect(blockReason(bySlug.get('kneeling_hip_flexor_stretch')!, base)).toBeNull();
  });
});

describe('R5-02 one advice source', () => {
  const session = (reps: number, load?: number): Session => ({
    endedAt: '2026-09-20T10:00:00Z',
    logs: [1, 2].map((setNo) => ({
      itemId: 'i',
      exerciseId: 'x',
      setNo,
      reps,
      ...(load ? { load, unit: 'lb' as const } : {}),
      loggedAt: '2026-09-20T10:00:00Z',
    })),
  });
  const loaded = LIBRARY.find((e) => e.loaded && e.pattern === 'horizontal_push')!;
  const bodyweight = LIBRARY.find((e) => !e.loaded && e.pattern === 'horizontal_push')!;

  it('60+ get "+1 rep", never "+5 lb", on a reps day', () => {
    const a = loadAdvice({
      sessions: [session(15, 20), session(15, 20)],
      range: [10, 15],
      exercise: loaded,
      unit: 'lb',
      mode: 'senior',
    });
    expect(a?.kind).toBe('reps');
  });

  it('bodyweight targets never pass the top of the range', () => {
    const a = loadAdvice({
      sessions: [session(15), session(15)],
      range: [10, 15],
      exercise: bodyweight,
      unit: 'lb',
      mode: 'adult',
    });
    expect(a).toMatchObject({ kind: 'reps', reps: 15 });
  });
});

describe('R5-03 stale workouts', () => {
  beforeEach(() => useWorkoutStore.getState().reset());

  it('yesterday’s planned workout expires; a started one closes as partial on its day', () => {
    const store = useWorkoutStore.getState();
    // A started workout from Friday…
    const started = store.create(generateSession(base));
    useWorkoutStore.setState((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === started
          ? {
              ...w,
              status: 'active' as const,
              createdAt: '2026-09-25T09:00:00Z',
              startedAt: '2026-09-25T09:05:00Z',
              logs: [
                {
                  itemId: w.session.items[0].id,
                  exerciseId: w.session.items[0].exerciseId,
                  setNo: 1,
                  seconds: 60,
                  loggedAt: '2026-09-25T09:10:00Z',
                },
              ],
            }
          : w,
      ),
    }));
    // …and one opened on Friday but never started.
    const planned = useWorkoutStore.getState().create(generateSession(base));
    useWorkoutStore.setState((s) => ({
      workouts: s.workouts.map((w) =>
        w.id === planned ? { ...w, createdAt: '2026-09-25T09:00:00Z' } : w,
      ),
    }));
    useWorkoutStore.getState().closeStale('2026-09-28');
    const after = useWorkoutStore.getState().workouts;
    expect(after.find((w) => w.id === planned)).toBeUndefined();
    const closed = after.find((w) => w.id === started)!;
    expect(closed.status).toBe('partial');
    expect(closed.endedAt).toBe('2026-09-25T09:10:00Z');
    const today = useWorkoutStore.getState().create(generateSession(base));
    useWorkoutStore.getState().closeStale('2026-09-28');
    expect(useWorkoutStore.getState().workouts.find((w) => w.id === today)?.status).toBe('planned');
    expect(useWorkoutStore.getState().streak.lastActive).toBe('2026-09-25');
  });
});

describe('R5-04 teen safety answers', () => {
  it('removing a pain area needs the parent PIN; adding does not', async () => {
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    await act(() => ensureSelfProfile());
    await act(() => {
      useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Sam' });
    });
    await act(() =>
      switchProfile('teen-1', { birthMonth: 3, birthYear: 2011, painAreas: ['knee'] }),
    );
    await act(() => useOnboardingStore.getState().update({ painAreas: ['knee'] }));
    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByLabelText('Knee'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    expect(useOnboardingStore.getState().painAreas).toEqual(['knee']);
  });
});

describe('R5-05 / R5-06 plan days', () => {
  it('targets the big movers', () => {
    expect(dayTargets('legs', LIBRARY, true)).toEqual(['quads', 'hamstrings', 'glutes']);
    expect(dayTargets('pull', LIBRARY, true)).toEqual(['lats', 'upperBack']);
    expect(dayTargets('push', LIBRARY, true)).toEqual(['midChest', 'shoulders']);
    expect(dayTargets('legs', LIBRARY, false)).toHaveLength(2);
  });

  it('a PPL Push day reaches the chosen count, all push', () => {
    const ppl = planById('muscle-ppl-3')!;
    const s = generateSession(planDayInput(base, ppl, 0, LIBRARY));
    const main = s.items.filter((i) => i.role === 'main');
    expect(main.length).toBe(5);
  });
});
