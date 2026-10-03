import type { Exercise } from '../exercises/types';
import { blockReason, isKidMove } from '../generator/filters';
import type { GeneratorInput } from '../generator/types';
import { muscleByKey, muscleFamily } from '../muscles';
import type { Position } from '../onboarding/options';

/**
 * Library browsing (improvements v1, B1–B2): the exercises safe for this
 * profile, filtered by muscle, search, equipment, position and role; the
 * ones ruled out by a restriction, pain or age sit apart with the reason and
 * can't be started from here.
 */
/** 60+ browse by area with big buttons (simpler than the body). */
export const AREAS: Record<string, string[]> = {
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  back: ['upperBack', 'lats', 'lowerBack'],
  chest: ['chest'],
  shoulders: ['shoulders', 'rearDelts', 'rotatorCuff'],
  core: ['abs', 'obliques'],
};

export type LibraryRole = 'main' | 'warmup' | 'stretch' | 'balance' | 'repair';
export type LibraryFilter = {
  muscle?: string;
  /** Any of these muscles (60+ area buttons). */
  muscles?: string[];
  query?: string;
  /** Equipment key, or "none" for bodyweight only. */
  equipment?: string;
  position?: Position;
  role?: LibraryRole;
  /** Cardio moves (the Exercises tab's heart, Phase 31, G). */
  cardio?: boolean;
};
export type NotForYouReason = 'restriction' | 'pain' | 'age' | 'painToday';
export type LibraryView = {
  safe: Exercise[];
  notForYou: { exercise: Exercise; reason: NotForYouReason }[];
};

const REASON: Record<string, NotForYouReason | undefined> = {
  contraindication: 'restriction',
  painful_movement: 'pain',
  age: 'age',
  impact: 'restriction',
};

export function roleOf(e: Exercise): LibraryRole[] {
  const roles: LibraryRole[] = [];
  if (e.rehab) roles.push('repair');
  else if (e.parts.includes('main')) roles.push('main');
  if (e.parts.some((p) => p.startsWith('warmup'))) roles.push('warmup');
  if (e.parts.includes('cooldown_stretch')) roles.push('stretch');
  if (e.pattern === 'balance') roles.push('balance');
  return roles;
}

/** Muscle and its sub-regions: "chest" also finds upper, mid and lower chest. */
function trains(e: Exercise, muscle: string): boolean {
  const parent = muscleByKey(muscle)?.parentKey ?? muscle;
  const family = new Set([muscle, ...(muscle === parent ? muscleFamily(muscle) : [])]);
  return e.muscles.some((m) => m.role === 'primary' && family.has(m.muscleKey));
}

export function libraryView(
  input: GeneratorInput,
  filter: LibraryFilter,
  name: (e: Exercise) => string,
): LibraryView {
  // Browsing may show recovery exercises (the generator still never programs them).
  const viewer: GeneratorInput = { ...input, rehab: true };
  const q = filter.query?.trim().toLowerCase();
  const matches = input.library.filter(
    (e) =>
      e.status !== 'retired' &&
      // Kid game moves are for kids only: never listed for anyone else.
      (input.mode === 'child' || !isKidMove(e)) &&
      (!filter.muscle || trains(e, filter.muscle)) &&
      (!filter.muscles?.length || filter.muscles.some((m) => trains(e, m))) &&
      (!q || name(e).toLowerCase().includes(q)) &&
      (!filter.equipment ||
        (filter.equipment === 'none'
          ? e.equipment.length === 0
          : e.equipment.includes(filter.equipment as never))) &&
      (!filter.position || e.positions.includes(filter.position)) &&
      (!filter.role || roleOf(e).includes(filter.role)) &&
      (!filter.cardio || e.parts.some((p) => p.includes('cardio'))),
  );
  const safe: Exercise[] = [];
  const notForYou: LibraryView['notForYou'] = [];
  for (const e of matches) {
    const why = blockReason(e, viewer);
    if (why === null) safe.push(e);
    else if (REASON[why]) {
      // Out only because of pain reported today: say so (QA R5 P2).
      const painToday =
        why === 'contraindication' &&
        !!(input.stoppedToday?.length || input.painToday?.length) &&
        blockReason(e, { ...viewer, stoppedToday: [], painToday: [] }) === null;
      notForYou.push({ exercise: e, reason: painToday ? 'painToday' : REASON[why]! });
    }
    // Drafts, location, equipment, level and kid-only moves are simply not listed.
  }
  const byName = (a: Exercise, b: Exercise) => name(a).localeCompare(name(b));
  return {
    safe: safe.sort(byName),
    notForYou: notForYou.sort((a, b) => byName(a.exercise, b.exercise)),
  };
}
