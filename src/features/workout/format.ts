import type { TFunction } from 'i18next';

import type { Exercise } from '../exercises/types';
import type { SessionItem } from '../generator/types';
import { muscleLabel } from '../onboarding/summaries';

/** i18n keys come from the database rows, so they are typed loosely here. */
export const exerciseName = (t: TFunction, e: Exercise | undefined, fallback: string) =>
  e?.custom ? (e.customName ?? fallback) : e ? t(e.nameKey as 'app.name') : fallback;

export const exerciseCues = (t: TFunction, e: Exercise | undefined) =>
  e?.custom ? '' : e ? t(e.cuesKey as 'app.name') : '';

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** "3 × 8–10", "2 × 30–45 s each side", "3 min". */
export function doseText(t: TFunction, item: SessionItem): string {
  const side = item.perSide ? ` ${t('workout.eachSide')}` : '';
  if (item.reps) return `${item.sets} × ${range(item.reps)}${side}`;
  if (item.holdSeconds) {
    const hold = t('workout.seconds', { value: range(item.holdSeconds) });
    return item.sets > 1 ? `${item.sets} × ${hold}${side}` : `${hold}${side}`;
  }
  return durationText(t, item.durationSeconds ?? 0);
}

/** Same time as the player shows: "2 min 42 s", not a rounded "3 min" (QA P2). */
export function durationText(t: TFunction, seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return t('workout.seconds', { value: s });
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest
    ? t('workout.minSec', { minutes: m, seconds: rest })
    : t('workout.minutes', { value: m });
}

/** Minutes of a warm-up or cool-down block: the sum of its items (QA P2). */
export function blockMinutes(items: SessionItem[]): number {
  const seconds = items.reduce((n, i) => n + (i.durationSeconds ?? i.estSeconds), 0);
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * "3 × 8–10 · rest 90 s" for main items (mockup 10). `restSeconds` is what
 * the timer will run (the Settings default when set, QA R4 P2).
 */
export function doseLine(t: TFunction, item: SessionItem, restSeconds = item.restSeconds): string {
  const dose = doseText(t, item);
  return item.role === 'main' && item.sets > 1
    ? `${dose} · ${t('workout.restFor', { seconds: restSeconds })}`
    : dose;
}

/** Target chip: "UPPER CHEST · GROW". */
export function targetText(t: TFunction, item: SessionItem, e: Exercise | undefined): string {
  const muscle =
    item.targetMuscle ?? e?.muscles.find((m) => m.role === 'primary')?.muscleKey ?? null;
  if (item.role === 'finisher') return t(`workout.finisher.${item.part as 'finisher_cardio'}`);
  // The protected balance item is labelled "Balance", not a muscle (QA R3-08).
  if (item.role === 'main' && item.goal === 'balance' && !item.targetMuscle)
    return t('muscleGoals.balance');
  const name = muscle ? muscleLabel(t, muscle) : '';
  return item.goal ? `${name} · ${t(`muscleGoals.${item.goal}`)}` : name;
}

export const clockText = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
