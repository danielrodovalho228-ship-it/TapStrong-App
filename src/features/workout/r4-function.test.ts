/**
 * QA round 4 — function P1: "Muscles worked" dots (R4-06), custom exercise
 * equipment (R4-07), split plan days (R4-08), equipment changes rebuild the
 * planned workout (R4-09) and "+1 rep" days keep the load (R4-10).
 */
import { workedDots } from '../bodymap/components/BodyPicker';
import { usePlacesStore } from '../equipment/store';
import { devLibrary } from '../exercises/library';
import { generateSession, type GeneratorInput } from '../generator';
import { customEquipment, customToExercise } from '../library/custom';
import { useLibraryStore } from '../library/store';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { withProgram } from '../program/apply';
import { dayName } from '../program/block';
import { planById, planDayInput } from '../program/plans';
import { plannedDaysBetween } from '../program/week';

import { discardPlannedWorkouts } from './hooks';
import { adviceLoad, loadAdvice, type Session } from './loads';
import { safetyKey, safetyRefresh } from './safety';
import { useWorkoutStore } from './store';

const LIBRARY = devLibrary();
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
  muscleGoals: [{ muscleKey: 'midChest', goal: 'strengthen' }],
  exercisesPerSession: 6,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};

describe('R4-06 muscles worked', () => {
  it('main muscles are filled, parent keys light their child dots, secondary is a halo', () => {
    const { main, halo } = workedDots(['chest'], ['triceps', 'midChest']);
    expect(main).toEqual(['upperChest', 'midChest', 'lowerChest']);
    expect(halo).toEqual(['triceps']);
  });
});

describe('R4-07 custom exercise equipment', () => {
  it('old coarse keys become items the filters know', () => {
    expect(customEquipment(['kettlebell', 'bands', 'cables', 'bench', 'machines'])).toEqual([
      'kettlebells',
      'long_bands',
      'cable_station',
      'flat_bench',
    ]);
    expect(customEquipment(['kettlebells', 'mini_bands'])).toEqual(['kettlebells', 'mini_bands']);
  });

  it('an old kettlebell exercise is available again with a kettlebell', () => {
    const e = customToExercise({
      id: 'custom_kb',
      name: 'KB swing',
      primary: ['glutes'],
      secondary: [],
      equipment: ['kettlebell'],
      joints: [],
      createdAt: '2026-09-01T00:00:00Z',
    });
    expect(e.equipment).toEqual(['kettlebells']);
  });

  it('saved custom exercises are migrated on load', async () => {
    const migrate = useLibraryStore.persist.getOptions().migrate!;
    const out = (await migrate(
      { custom: [{ id: 'c', name: 'x', primary: [], secondary: [], equipment: ['cables'] }] },
      1,
    )) as { custom: { equipment: string[] }[] };
    expect(out.custom[0].equipment).toEqual(['cable_station']);
  });
});

describe('R4-08 split plans', () => {
  const ppl = planById('muscle-ppl-3')!;

  it('a Push day stays push: the filler adds only the day’s groups', () => {
    const input = planDayInput(base, ppl, 0, LIBRARY);
    expect(input.dayGroups).toEqual(['push']);
    const s = generateSession(input);
    expect(s.error).toBeUndefined();
    expect(dayName(s, LIBRARY)).toBe('push');
    const legs = generateSession(planDayInput(base, ppl, 2, LIBRARY));
    expect(dayName(legs, LIBRARY)).toMatch(/legs|lower/);
  });

  it('full-body days keep balancing every group', () => {
    const full = planDayInput(base, planById('shape-fullBody-3')!, 0, LIBRARY);
    expect(full.dayGroups).toBeUndefined();
  });

  it('a future day previews the plan day it will be', () => {
    // Mon 28 Sep 2026, a 3-day plan trains Mon, Wed, Fri (week from Sunday).
    expect(plannedDaysBetween('2026-09-28', '2026-10-02', 0, 3)).toEqual([
      '2026-09-28',
      '2026-09-30',
    ]);
    const program = { planId: ppl.id, startedAt: '2026-09-28' };
    const today = withProgram(base, LIBRARY, [], program, '2026-09-28', 0);
    const friday = withProgram(base, LIBRARY, [], program, '2026-10-02', 2);
    expect(today.dayGroups).toEqual(['push']);
    expect(friday.dayGroups).toEqual(['legs']);
  });
});

describe('R4-09 equipment changes', () => {
  beforeEach(() => useWorkoutStore.getState().reset());

  it('the rebuild key follows equipment and place', () => {
    expect(safetyKey(base)).not.toBe(safetyKey({ ...base, equipment: ['dumbbells'] }));
    expect(safetyKey(base)).not.toBe(safetyKey({ ...base, location: 'home' }));
  });

  it('a planned workout needing removed equipment is rebuilt', () => {
    const session = generateSession(base);
    const id = useWorkoutStore.getState().create(session);
    const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
    expect(safetyRefresh(w, { ...base, equipment: [], location: 'home' }).kind).toBe('regenerate');
  });

  it('plan or equipment changes drop the unstarted planned workout only', () => {
    const store = useWorkoutStore.getState();
    const planned = store.create(generateSession(base));
    discardPlannedWorkouts();
    expect(useWorkoutStore.getState().workouts.some((w) => w.id === planned)).toBe(false);
  });

  it('the active place is cleared when the list no longer matches', () => {
    usePlacesStore.getState().reset();
    usePlacesStore
      .getState()
      .save({ id: 'p1', name: 'Home', location: 'home', items: ['dumbbells', 'mat'] });
    usePlacesStore.getState().syncActive('home', ['mat', 'dumbbells']);
    expect(usePlacesStore.getState().activeId).toBe('p1');
    usePlacesStore.getState().syncActive('home', ['mat']);
    expect(usePlacesStore.getState().activeId).toBeNull();
  });
});

describe('R4-10 "+1 rep" days keep the load', () => {
  const session = (reps: number, load: number): Session => ({
    endedAt: '2026-09-20T10:00:00Z',
    logs: [1, 2, 3].map((setNo) => ({
      itemId: 'i',
      exerciseId: 'dumbbell_bench_press',
      setNo,
      reps,
      load,
      unit: 'lb' as const,
      loggedAt: '2026-09-20T10:00:00Z',
    })),
  });
  const bench = LIBRARY.find((e) => e.loaded && e.pattern === 'horizontal_push')!;

  it('60+ get more reps at the same 40 lb, not 0 lb', () => {
    const advice = loadAdvice({
      sessions: [session(12, 40), session(12, 40)],
      range: [8, 12],
      exercise: bench,
      unit: 'lb',
      mode: 'senior',
    });
    expect(advice).toMatchObject({ kind: 'reps', reps: 13, load: 40 });
    expect(adviceLoad(advice)).toBe(40);
  });

  it('joint care too', () => {
    const advice = loadAdvice({
      sessions: [session(12, 40), session(12, 40)],
      range: [8, 12],
      exercise: bench,
      unit: 'lb',
      mode: 'adult',
      jointCare: true,
    });
    expect(adviceLoad(advice)).toBe(40);
  });

  it('bodyweight reps days carry no load', () => {
    const pushUp = LIBRARY.find((e) => !e.loaded && e.dose === 'reps')!;
    const advice = loadAdvice({
      sessions: [session(12, 0), session(12, 0)],
      range: [8, 12],
      exercise: pushUp,
      unit: 'lb',
      mode: 'adult',
    });
    expect(advice?.kind).toBe('reps');
    expect(adviceLoad(advice)).toBeNull();
  });
});
