import type { LoadUnit, WorkoutRecord } from '../workout/types';

/**
 * Exercise performance (improvements v1, B3): personal records, a history by
 * session and the sessions list. Loads are compared in kilograms and shown
 * in the person's unit. Estimated 1RM uses Epley: load × (1 + reps / 30).
 */
const LB = 0.45359237;
const toKg = (v: number, unit: LoadUnit | undefined) => (unit === 'lb' ? v * LB : v);
const fromKg = (kg: number, unit: LoadUnit) => {
  const v = unit === 'lb' ? kg / LB : kg;
  return Math.round(v * 2) / 2;
};

export const epley = (load: number, reps: number) => (reps <= 1 ? load : load * (1 + reps / 30));

export type SessionPoint = {
  workoutId: string;
  date: string;
  sets: number;
  bestLoad: number | null;
  bestReps: number | null;
  volume: number;
};
export type Records = {
  heaviest: number | null;
  oneRepMax: number | null;
  bestSetVolume: number | null;
  sessions: SessionPoint[];
};

export function exerciseRecords(
  workouts: WorkoutRecord[],
  exerciseId: string,
  unit: LoadUnit,
): Records {
  let heaviest = 0;
  let oneRm = 0;
  let bestSet = 0;
  const sessions: SessionPoint[] = [];
  for (const w of workouts) {
    if (w.status !== 'done' && w.status !== 'partial') continue;
    const logs = w.logs.filter((l) => l.exerciseId === exerciseId);
    if (!logs.length) continue;
    let bestLoad = 0;
    let bestReps = 0;
    let volume = 0;
    for (const l of logs) {
      const kg = l.load ? toKg(l.load, l.unit) : 0;
      const reps = l.reps ?? 0;
      heaviest = Math.max(heaviest, kg);
      if (kg && reps) {
        oneRm = Math.max(oneRm, epley(kg, reps));
        bestSet = Math.max(bestSet, kg * reps);
        volume += kg * reps;
      }
      bestLoad = Math.max(bestLoad, kg);
      bestReps = Math.max(bestReps, reps);
    }
    sessions.push({
      workoutId: w.id,
      date: w.endedAt ?? w.createdAt,
      sets: logs.length,
      bestLoad: bestLoad ? fromKg(bestLoad, unit) : null,
      bestReps: bestReps || null,
      volume: Math.round(unit === 'lb' ? volume / LB : volume),
    });
  }
  sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    heaviest: heaviest ? fromKg(heaviest, unit) : null,
    oneRepMax: oneRm ? fromKg(oneRm, unit) : null,
    bestSetVolume: bestSet ? Math.round(unit === 'lb' ? bestSet / LB : bestSet) : null,
    sessions,
  };
}

/**
 * Which records each mode sees (B3): teens get reps and consistency only (no
 * 1RM or volume), 60+ the heaviest weight and the sessions (fewer numbers).
 */
export function visibleRecords(mode: string): ('heaviest' | 'oneRepMax' | 'bestSetVolume')[] {
  if (mode === 'child' || mode === 'teen') return [];
  if (mode === 'senior') return ['heaviest'];
  return ['heaviest', 'oneRepMax', 'bestSetVolume'];
}
