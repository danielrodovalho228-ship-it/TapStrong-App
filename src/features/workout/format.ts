import type { TFunction } from 'i18next';

import type { Exercise } from '../exercises/types';
import type { SessionItem } from '../generator/types';
import { muscleLabel } from '../onboarding/summaries';

/** i18n keys come from the database rows, so they are typed loosely here. */
export const exerciseName = (t: TFunction, e: Exercise | undefined, fallback: string) =>
  e ? t(e.nameKey as 'app.name') : fallback;

export const exerciseCues = (t: TFunction, e: Exercise | undefined) =>
  e ? t(e.cuesKey as 'app.name') : '';

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

export function durationText(t: TFunction, seconds: number): string {
  return seconds >= 60
    ? t('workout.minutes', { value: Math.round(seconds / 60) })
    : t('workout.seconds', { value: seconds });
}

/** "3 × 8–10 · rest 90 s" for main items (mockup 10). */
export function doseLine(t: TFunction, item: SessionItem): string {
  const dose = doseText(t, item);
  return item.role === 'main' && item.sets > 1
    ? `${dose} · ${t('workout.restFor', { seconds: item.restSeconds })}`
    : dose;
}

/** Target chip: "UPPER CHEST · GROW". */
export function targetText(t: TFunction, item: SessionItem, e: Exercise | undefined): string {
  const muscle =
    item.targetMuscle ?? e?.muscles.find((m) => m.role === 'primary')?.muscleKey ?? null;
  const name = muscle ? muscleLabel(t, muscle) : '';
  if (item.role === 'finisher') return t(`workout.finisher.${item.part as 'finisher_cardio'}`);
  return item.goal ? `${name} · ${t(`muscleGoals.${item.goal}`)}` : name;
}

export const clockText = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
