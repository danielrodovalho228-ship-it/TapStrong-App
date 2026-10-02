import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';

/** "Easy" on the effort chips (Phase 14 A4: Easy 6, Solid 8, Very hard 10). */
export const EASY_RPE = 6;
const WEEK_MS = 7 * 864e5;

const finished = (w: WorkoutRecord) => w.status === 'done' || w.status === 'partial';
const endOf = (w: WorkoutRecord) => Date.parse(w.endedAt ?? w.startedAt ?? w.createdAt);

/** Finished sessions of this program, oldest first. */
export function programWorkouts(workouts: WorkoutRecord[], programId: string): WorkoutRecord[] {
  return workouts
    .filter((w) => finished(w) && w.session.program?.id === programId)
    .sort((a, b) => endOf(a) - endOf(b));
}

/** Any "I feel pain" in this program in the last 7 days (Phase 30, §5.4). */
export function painThisWeek(workouts: WorkoutRecord[], programId: string, now: Date): boolean {
  return workouts.some(
    (w) =>
      w.session.program?.id === programId &&
      w.pains.some((p) => now.getTime() - Date.parse(p.reportedAt) < WEEK_MS),
  );
}

/** Every set of the exercise marked "Easy" and no pain on it in that session. */
function easyAndPainless(w: WorkoutRecord, exerciseId: string): boolean {
  const logs = w.logs.filter((l) => l.exerciseId === exerciseId);
  if (!logs.length) return false;
  if (w.pains.some((p) => p.exerciseId === exerciseId)) return false;
  return logs.every((l) => l.rpe === EASY_RPE);
}

export type ProgramLoadAdvice =
  { kind: 'raise' } | { kind: 'keep'; reason: 'pain' | 'notYet' | 'max' };

/**
 * Load progression (Phase 30, §3 and §5.4): after 2 sessions in a row with
 * the exercise marked "easy and painless", suggest raising the load (about
 * 0.5 kg or a slightly stronger band) and going back to fewer reps. Never
 * with "I feel pain" anywhere in the program this week.
 */
export function programLoadAdvice(o: {
  workouts: WorkoutRecord[];
  programId: string;
  exercise: Exercise;
  now: Date;
  /** The heaviest load the program allows was already used. */
  atMax?: boolean;
}): ProgramLoadAdvice {
  if (painThisWeek(o.workouts, o.programId, o.now)) return { kind: 'keep', reason: 'pain' };
  if (o.atMax) return { kind: 'keep', reason: 'max' };
  const done = programWorkouts(o.workouts, o.programId).filter((w) =>
    w.logs.some((l) => l.exerciseId === o.exercise.id),
  );
  const lastTwo = done.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((w) => easyAndPainless(w, o.exercise.id)))
    return { kind: 'raise' };
  return { kind: 'keep', reason: 'notYet' };
}
