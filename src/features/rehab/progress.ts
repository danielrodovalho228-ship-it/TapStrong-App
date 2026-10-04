import type { Exercise } from '../exercises/types';
import type { WorkoutRecord } from '../workout/types';
import { addDays, daysBetween, localDate, type LocalDate } from '@/lib/dates';

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

const dayOfWorkout = (w: WorkoutRecord) => localDate(new Date(endOf(w)));

/** Days with a finished session of this program (any part, sleeper breaks too). */
export function programDays(workouts: WorkoutRecord[], programId: string): Set<LocalDate> {
  return new Set(programWorkouts(workouts, programId).map(dayOfWorkout));
}

/**
 * Days in a row with the shoulder done (Phase 32 C, "Sexy"): up to today, or
 * up to yesterday while today is still open. Never a guilt counter: it only
 * shows when it is 2 or more.
 */
export function programStreak(days: Set<LocalDate>, today: LocalDate): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Days with the stretches that make a program week complete (5–6 days a week, §2). */
export const WEEK_COMPLETE_DAYS = 5;

/**
 * The program week that just ended complete (Phase 32 C, "Surprising":
 * "Week 1 done. Your shoulder thanks you."), shown during the next week.
 */
export function weekJustDone(
  days: Set<LocalDate>,
  startedAt: LocalDate,
  today: LocalDate,
): number | null {
  const week = Math.floor(daysBetween(startedAt, today) / 7) + 1;
  if (week < 2) return null;
  const from = addDays(startedAt, (week - 2) * 7);
  let n = 0;
  for (let d = 0; d < 7; d++) if (days.has(addDays(from, d))) n++;
  return n >= WEEK_COMPLETE_DAYS ? week - 1 : null;
}

/** "How high did you lift your arm today?" (Phase 32 C): 0–180°, one per day. */
export type RomEntry = { date: LocalDate; degrees: number };
export const ROM_STEPS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180] as const;

/** The best of each program week, week 1 first (the weekly curve). */
export function romByWeek(
  entries: RomEntry[],
  startedAt: LocalDate,
  weeks: number,
): (number | null)[] {
  const best: (number | null)[] = Array.from({ length: weeks }, () => null);
  for (const e of entries) {
    const w = Math.floor(daysBetween(startedAt, e.date) / 7);
    if (w < 0 || w >= weeks) continue;
    best[w] = Math.max(best[w] ?? 0, e.degrees);
  }
  return best;
}
