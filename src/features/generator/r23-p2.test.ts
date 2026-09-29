/**
 * QA round 10 P2, generator: the "+1" estimate never drifts, and a goal
 * blocked only by the painful-joint budget gets the joint note.
 */
import { devLibrary } from '../exercises/library';
import { movedAreas } from '../movement/catalog';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { generateSession, withOneMoreExercise } from './generate';
import type { GeneratedSession, GeneratorInput } from './types';

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

/** What the list adds up to, the way the generator estimates it. */
const listMinutes = (s: GeneratedSession) =>
  s.warmupMinutes +
  s.cooldownMinutes +
  s.items
    .filter((i) => i.role === 'main' || i.role === 'finisher')
    .reduce((n, i) => n + i.estSeconds, 0) /
    60;

describe('"+1" estimate', () => {
  it('90 min, 3 exercises, every accept: the header is the list rounded, no drift', () => {
    let s = generateSession(base);
    let accepts = 0;
    for (let next = withOneMoreExercise(base, s); next; next = withOneMoreExercise(base, s)) {
      s = next;
      accepts++;
      expect(s.estimatedMinutes).toBe(Math.round(listMinutes(s)));
      expect(listMinutes(s)).toBeLessThanOrEqual(s.minutes);
    }
    expect(accepts).toBeGreaterThanOrEqual(3);
  });
});

describe('joint budget note', () => {
  // Only moves that move the joint are left for the goal, so the budget is
  // the one thing that keeps it out.
  const onlyMoving = (area: string, muscle: string) =>
    LIBRARY.filter(
      (e) =>
        !e.muscles.some((m) => m.role === 'primary' && m.muscleKey === muscle) ||
        movedAreas(e.joints).includes(area),
    );
  const week = (area: string, used: number) => [
    {
      date: '2026-09-26',
      at: '2026-09-26T09:00:00Z',
      mainMuscles: [],
      exerciseIds: [],
      muscleSets: {},
      jointSets: { [area]: used },
    },
  ];

  it.each([
    ['knee', 'quads'],
    ['shoulder', 'lats'],
  ])('%s pain, goal %s, budget used up: "joint limit", not "no safe exercise"', (area, muscle) => {
    const input: GeneratorInput = {
      ...base,
      library: onlyMoving(area, muscle),
      exercisesPerSession: 4,
      painAreas: [area],
      muscleGoals: [{ muscleKey: muscle, goal: 'grow' }],
    };
    // With budget left the goal is trained (so the test can fail).
    const free = generateSession({ ...input, recentSessions: week(area, 0) });
    expect(free.items.some((i) => i.role === 'main' && i.targetMuscle === muscle)).toBe(true);
    const s = generateSession({ ...input, recentSessions: week(area, 12) });
    expect(s.items.some((i) => i.role === 'main' && i.targetMuscle === muscle)).toBe(false);
    const keys = s.notes.map((n) => n.key);
    expect(keys).not.toContain('generator.notes.substituted');
    expect(keys).not.toContain('generator.notes.unavailable');
    expect(s.notes).toContainEqual({ key: 'generator.notes.jointCap', joints: [area] });
  });

  it('a goal still trained by a move that only holds the joint gets no note', () => {
    const s = generateSession({
      ...base,
      exercisesPerSession: 4,
      painAreas: ['knee'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'grow' }],
      recentSessions: week('knee', 12),
    });
    expect(s.items.some((i) => i.role === 'main' && i.targetMuscle === 'quads')).toBe(true);
    expect(s.notes.map((n) => n.key)).not.toContain('generator.notes.jointCap');
  });
});
