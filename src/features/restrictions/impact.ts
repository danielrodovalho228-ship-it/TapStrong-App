import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';

/** Exercises of the library an area rules out (their contraindications). */
export function excludedCount(
  library: Exercise[],
  area: string,
): { excluded: number; total: number } {
  const main = library.filter((e) => e.parts.includes('main'));
  return {
    excluded: main.filter((e) => e.contraindications.includes(area)).length,
    total: main.length,
  };
}

/** Swaps made because of pain in this area (mockup 20: "1 exercise swapped so far"). */
export function painSwaps(workouts: WorkoutRecord[], area: string): number {
  return workouts.reduce(
    (n, w) => n + w.pains.filter((p) => p.area === area && p.action === 'swapped').length,
    0,
  );
}
