/**
 * QA round 10 P2, "+1 exercise?": the workout keeps its "Legs next time"
 * focus for "+1" and rebuilds; the generator input is stable across renders;
 * exercises added with "+1" come back after a plan change, or are named when
 * they no longer fit.
 */
import { renderHook } from '@testing-library/react-native';

import { devLibrary } from '../exercises/library';
import {
  generateSession,
  withAddedExercises,
  withOneMoreExercise,
  type GeneratorInput,
} from '../generator';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { createWorkoutFrom, discardPlannedWorkouts, refreshWorkout, useStableInput } from './hooks';
import { useWorkoutStore } from './store';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const LIBRARY = devLibrary();
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 90,
  mainGoals: ['look'],
  muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
  exercisesPerSession: 3,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const workout = (id: string | null) =>
  useWorkoutStore.getState().workouts.find((w) => w.id === id)!;

beforeEach(() => useWorkoutStore.getState().reset());

describe('the focus stays with the workout', () => {
  it('"Legs next time" is stored on the workout, and a safety rebuild keeps it', () => {
    useWorkoutStore.getState().setNextFocus('legs');
    const id = createWorkoutFrom(base, LIBRARY);
    expect(workout(id).session.groupFocus).toBe('legs');
    // The one-time choice is used up, but the workout remembers it.
    expect(useWorkoutStore.getState().nextFocus).toBeNull();
    // A new restriction forces a rebuild: still the legs workout.
    const next = refreshWorkout(id!, { ...base, restrictions: ['knee'] }, LIBRARY);
    expect(next).not.toBe(id);
    expect(workout(next).session.groupFocus).toBe('legs');
  });

  it('no focus chosen: none stored', () => {
    const id = createWorkoutFrom(base, LIBRARY);
    expect(workout(id).session.groupFocus).toBeUndefined();
  });
});

describe('a stable input for "+1"', () => {
  it('the same object while only the clock moves, a new one when a setting changes', async () => {
    const { result, rerender } = await renderHook(
      ({ input }: { input: GeneratorInput }) => useStableInput(input),
      {
        initialProps: { input: base },
      },
    );
    const first = result.current;
    await rerender({ input: { ...base, now: '2026-09-28T12:00:05Z' } });
    expect(result.current).toBe(first);
    await rerender({ input: { ...base, minutes: 60 } });
    expect(result.current).not.toBe(first);
  });
});

describe('added exercises after a plan change', () => {
  it('come back on the next build when they fit', () => {
    let s = generateSession(base);
    s = withOneMoreExercise(base, s)!;
    s = withOneMoreExercise(base, s)!;
    useWorkoutStore.getState().create(s);
    discardPlannedWorkouts();
    expect(useWorkoutStore.getState().addedLost).toBe(2);
    const id = createWorkoutFrom(base, LIBRARY);
    expect(workout(id).session.addedExercises).toBe(2);
    expect(useWorkoutStore.getState().addedLost).toBe(0);
  });

  it('are named when they no longer fit', () => {
    let s = generateSession(base);
    s = withOneMoreExercise(base, s)!;
    useWorkoutStore.getState().create(s);
    discardPlannedWorkouts();
    // The new plan fills its time: nothing more fits.
    const id = createWorkoutFrom({ ...base, minutes: 30 }, LIBRARY);
    expect(workout(id).session.notes).toContainEqual({
      key: 'generator.notes.addedRemoved',
      count: 1,
    });
  });

  it('withAddedExercises names only the ones that were not put back', () => {
    const s = generateSession(base);
    const out = withAddedExercises(base, s, 50);
    const note = out.notes.find((n) => n.key === 'generator.notes.addedRemoved');
    expect(note).toEqual({
      key: 'generator.notes.addedRemoved',
      count: 50 - (out.addedExercises ?? 0),
    });
  });
});
