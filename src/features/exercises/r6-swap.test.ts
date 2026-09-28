/**
 * QA round 6 — P2: the overhead triceps stretch (60+, seated only, every
 * equipment preset) had only 2 swap options; a seated behind-the-back
 * triceps stretch joins them.
 */
import { getAlternatives } from '../generator/alternatives';
import type { GeneratedSession, GeneratorInput } from '../generator/types';
import { PALETTES } from '../../theme/palettes';

import { devLibrary } from './library';

const LIBRARY = devLibrary();
const stretch = LIBRARY.find((e) => e.slug === 'overhead_triceps_stretch')!;
const joe: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'senior',
  band: 'senior',
  position: 'seated_only',
  location: 'home',
  equipment: [],
  minutes: 30,
  mainGoals: ['balance'],
  muscleGoals: [],
  exercisesPerSession: 3,
  setsPerExercise: 2,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

it.each([[[]], [['chair']], [['chair', 'dumbbells', 'long_bands']]])(
  'seated-only 60+ with equipment %j: at least 3 swaps for the overhead triceps stretch',
  (equipment) => {
    const session = {
      items: [
        {
          id: 'c1',
          role: 'cooldown',
          part: 'cooldown_stretch',
          exerciseId: stretch.id,
          targetMuscle: 'triceps',
          sets: 1,
          holdSeconds: [20, 30],
        },
      ],
    } as unknown as GeneratedSession;
    const options = getAlternatives(session, 'c1', { ...joe, equipment: equipment as never });
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.map((e) => e.slug)).toContain('st_seated_behind_back_triceps');
  },
);

it('sheet backdrops are black at 50% in both modes (QA R6 P2)', () => {
  expect(PALETTES.light.scrim).toBe('rgba(0, 0, 0, 0.5)');
  expect(PALETTES.dark.scrim).toBe(PALETTES.light.scrim);
});
