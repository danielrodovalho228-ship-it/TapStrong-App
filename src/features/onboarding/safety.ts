import type { AppMode } from '../profile/age';

import { CONDITIONS, RED_FLAGS, type Condition, type PainArea, type Sex } from './options';

/** Toggles a value in a multi-select list where an empty list means "None". */
export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Pregnancy is not offered to children or users who chose the male body. */
export function visibleConditions(mode: AppMode, sex: Sex | null | undefined): Condition[] {
  return CONDITIONS.filter((c) => {
    if (c === 'pregnant_postpartum') return mode !== 'child' && sex !== 'm';
    return true;
  });
}

export function hasRedFlag(painAreas: readonly PainArea[], conditions: readonly Condition[]) {
  return [...painAreas, ...conditions].some((v) => RED_FLAGS.includes(v));
}

/** Pain areas become restrictions that filter every workout. Surgery is a condition. */
export function restrictionAreas(painAreas: readonly PainArea[]): PainArea[] {
  return painAreas.filter((a) => a !== 'recent_surgery');
}
