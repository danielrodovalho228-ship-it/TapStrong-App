import type { Exercise } from '../exercises/types';
import type { AppMode } from '../profile/age';
import type { WorkoutRecord } from '../workout/types';

import type { Checkin, StrengthRow } from './store';

/** Check-in every 4 weeks (SPEC §8 "Measurements"). */
export const CHECKIN_DAYS = 28;
const DAY = 86_400_000;
const KG_PER_LB = 0.45359237;

/** Body measurements and indexes: adults only (SPEC §2.3). */
// Adults 18–59 only (QA R4 P2): 60+ keep a simpler Progress with no body numbers.
export const measurementsAllowed = (mode: AppMode) => mode === 'adult';

/**
 * Before/after photos: adults, and 60+ once turned on (off by default).
 * Never for children or teens (SPEC §2.3–2.4).
 */
export const photosAllowed = (mode: AppMode | undefined, seniorPhotos: boolean) =>
  mode === 'adult' || (mode === 'senior' && seniorPhotos);

/** Due once the first workout is 4 weeks old, then every 4 weeks. */
export function checkinDue(workouts: WorkoutRecord[], checkins: Checkin[], now: Date): boolean {
  const first = workouts
    .filter((w) => (w.status === 'done' || w.status === 'partial') && w.logs.length > 0)
    .map((w) => Date.parse(w.endedAt ?? w.createdAt))
    .sort((a, b) => a - b)[0];
  if (first === undefined) return false;
  const last = checkins.map((c) => Date.parse(c.takenAt)).sort((a, b) => b - a)[0];
  const since = last ?? first;
  return now.getTime() - since >= CHECKIN_DAYS * DAY;
}

type Best = {
  value: number;
  reps?: number;
  unit?: 'lb' | 'kg';
  score: number;
  kind: StrengthRow['kind'];
};

function bestSets(workouts: WorkoutRecord[], from: number, to: number): Map<string, Best> {
  const out = new Map<string, Best>();
  for (const w of workouts) {
    if (w.status !== 'done' && w.status !== 'partial') continue;
    const main = new Set(w.session.items.filter((i) => i.role === 'main').map((i) => i.id));
    for (const l of w.logs) {
      const t = Date.parse(l.loggedAt);
      if (!main.has(l.itemId) || t < from || t > to) continue;
      let best: Best;
      if (l.load != null && l.load > 0 && l.reps != null) {
        const kg = l.unit === 'lb' ? l.load * KG_PER_LB : l.load;
        best = { value: l.load, reps: l.reps, unit: l.unit, score: kg * l.reps, kind: 'load' };
      } else if (l.reps != null) {
        best = { value: l.reps, score: l.reps, kind: 'reps' };
      } else if (l.seconds != null) {
        best = { value: l.seconds, score: l.seconds, kind: 'seconds' };
      } else continue;
      const prev = out.get(l.exerciseId);
      if (
        !prev ||
        (prev.kind === best.kind && best.score > prev.score) ||
        (prev.kind !== 'load' && best.kind === 'load')
      ) {
        out.set(l.exerciseId, best);
      }
    }
  }
  return out;
}

/**
 * Strength, week 1 vs week 4 of the last 4 weeks (mockup 25): the best set
 * of each exercise done in both weeks. Load × reps for loaded work, reps for
 * bodyweight, seconds for holds.
 */
export function strengthChanges(workouts: WorkoutRecord[], now: Date, max = 3): StrengthRow[] {
  const end = now.getTime();
  const start = end - CHECKIN_DAYS * DAY;
  const first = bestSets(workouts, start, start + 7 * DAY);
  const last = bestSets(workouts, end - 7 * DAY, end);
  const rows: StrengthRow[] = [];
  for (const [id, a] of first) {
    const b = last.get(id);
    if (!b || a.kind !== b.kind) continue;
    const change =
      a.kind === 'load' ? Math.round(((b.score - a.score) / a.score) * 100) : b.value - a.value;
    rows.push({
      exerciseId: id,
      kind: a.kind,
      first: { value: a.value, reps: a.reps, unit: a.unit },
      last: { value: b.value, reps: b.reps, unit: b.unit },
      change,
    });
  }
  return rows
    .sort((x, y) => y.change - x.change || (x.exerciseId < y.exerciseId ? -1 : 1))
    .slice(0, max);
}

/** Waist-to-height ratio, the primary index (SPEC §8). */
export const whtr = (waistCm: number, heightCm: number) =>
  Math.round((waistCm / heightCm) * 100) / 100;

export const bmi = (weightKg: number, heightCm: number) =>
  Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;

export type WhtrBand = 'healthy' | 'increased' | 'high';
export const whtrBand = (v: number): WhtrBand =>
  v < 0.5 ? 'healthy' : v < 0.6 ? 'increased' : 'high';

export type CoachNote =
  | { key: 'waistAndStrength'; waist: number }
  | { key: 'strength' }
  | { key: 'waist'; waist: number }
  | { key: 'steady' }
  | { key: 'firstCheckin' };

/** Deterministic, encouraging note; never medical advice. */
export function coachNote(strength: StrengthRow[], waistChange: number | null): CoachNote {
  const stronger = strength.some((r) => r.change > 0);
  const waistDown = waistChange != null && waistChange <= -0.5;
  if (waistDown && stronger) return { key: 'waistAndStrength', waist: Math.abs(waistChange) };
  if (stronger) return { key: 'strength' };
  if (waistDown) return { key: 'waist', waist: Math.abs(waistChange) };
  if (!strength.length && waistChange == null) return { key: 'firstCheckin' };
  return { key: 'steady' };
}

/** Exercises named in the strength table must exist in the library. */
export const strengthExercise = (library: Exercise[], id: string) =>
  library.find((e) => e.id === id);
