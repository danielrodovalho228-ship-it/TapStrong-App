/**
 * QA round 9 — "+1 exercise?" (R9-01..03, Daniel's decision 4): only over
 * 45 min, never in deload, keeps every exercise already on the list, adds
 * exactly one, and can be offered again while time and the cap allow it.
 */
import { devLibrary } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import {
  generateSession,
  offersOneMore,
  withAddedExercises,
  withOneMoreExercise,
} from './generate';
import type { GeneratorInput } from './types';

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
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const mainIds = (s: { items: { role: string; exerciseId: string }[] }) =>
  s.items.filter((i) => i.role === 'main').map((i) => i.exerciseId);

describe('R9-01 only over 45 min', () => {
  it.each(['adult', 'teen', 'senior'] as const)(
    '%s: 1–5 exercises at 30/45 min never offer it',
    (mode) => {
      for (const minutes of [30, 45])
        for (let n = 1; n <= 5; n++) {
          const s = generateSession({
            ...base,
            mode,
            band: mode === 'senior' ? 'senior' : mode === 'teen' ? 'teen' : 'adult',
            minutes,
            exercisesPerSession: n,
          });
          expect({ minutes, n, offer: offersOneMore(s) }).toMatchObject({ offer: false });
          expect(withOneMoreExercise(base, s)).toBeNull();
        }
    },
  );

  it('90 min with 5 exercises offers it', () => {
    expect(offersOneMore(generateSession(base))).toBe(true);
  });
});

describe('R9-02 accepting keeps every exercise already shown', () => {
  it.each([
    ['adult 5', {}],
    ['adult 8', { exercisesPerSession: 8, minutes: 120 }],
    ['teen 5', { mode: 'teen', band: 'teen', location: 'home', equipment: ['long_bands', 'mat'] }],
  ] as const)('%s: all old ids kept in order, exactly one new', (_n, patch) => {
    const input = { ...base, ...(patch as Partial<GeneratorInput>) };
    const s = generateSession(input);
    const more = withOneMoreExercise(input, s);
    expect(more).not.toBeNull();
    if (!more) return;
    const before = mainIds(s);
    const after = mainIds(more);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toHaveLength(before.length + 1);
    // Sets, warm-up and cool-down of what was shown don't change.
    const shown = (x: typeof s) =>
      x.items
        .filter((i) => i.role !== 'main' || before.includes(i.exerciseId))
        .map((i) => [i.exerciseId, i.sets]);
    expect(shown(more)).toEqual(shown(s));
    expect(more.estimatedMinutes).toBeGreaterThan(s.estimatedMinutes);
    expect(more.estimatedMinutes).toBeLessThanOrEqual(input.minutes);
  });
});

describe('R9-03 never in deload', () => {
  it('a deload week under 85% gets no offer', () => {
    const d = generateSession({ ...base, deload: true });
    expect(d.estimatedMinutes).toBeLessThan(0.85 * 90);
    expect(offersOneMore(d)).toBe(false);
    expect(withOneMoreExercise(base, d)).toBeNull();
  });
});

describe("Daniel's decision 4: offered again while it still fits", () => {
  it('each accept keeps the previous ones; it stops under the time and the cap', () => {
    let s = generateSession({ ...base, minutes: 120, exercisesPerSession: 4 });
    const seen: string[][] = [mainIds(s)];
    for (let n = 0; n < 8; n++) {
      const more = withOneMoreExercise(base, { ...s, minutes: 120 });
      if (!more) break;
      expect(mainIds(more).slice(0, mainIds(s).length)).toEqual(mainIds(s));
      s = more;
      seen.push(mainIds(s));
    }
    expect(seen.length).toBeGreaterThan(2);
    expect(s.estimatedMinutes).toBeLessThanOrEqual(120);
    expect(s.addedExercises).toBe(seen.length - 1);
  });

  it('a rebuild (place switch, safety) puts the added ones back', () => {
    const s = generateSession(base);
    const once = withOneMoreExercise(base, s)!;
    const rebuilt = withAddedExercises(base, generateSession(base), once.addedExercises ?? 0);
    expect(mainIds(rebuilt)).toEqual(mainIds(once));
  });
});
