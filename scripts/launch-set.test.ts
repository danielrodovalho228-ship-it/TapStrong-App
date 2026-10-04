/**
 * The launch set (Daniel, Oct 3): the ~150–200 exercises a certified reviewer
 * checks before the first store release, instead of all 767. Only the ones
 * approved there become `released`; the rest follow in later updates.
 *
 * Picked, in this order (each exercise keeps its first reason):
 *   1. `clips`: an approved clip for both sexes;
 *   2. `first_workout`: any exercise a first workout can show, for adults,
 *      teens and 60+, at home and at the gym (warm-up and cool-down too);
 *   3. `shoulder`: the shoulder program's exercises;
 *   4. `coverage`: the fewest more so every muscle on the Exercises map has at
 *      least 3 options at home and 3 at the gym (clips first, then easier).
 *
 * `npm run launch-set` rewrites supabase/seed/launch_set.json; otherwise this
 * test fails when the committed list is out of date.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import seed from '../supabase/seed/exercises.json';

import { GROUP_DOTS } from '../src/app/(tabs)/body';
import { fromSeed, type SeedExercise } from '../src/features/exercises/library';
import type { Exercise } from '../src/features/exercises/types';
import { generateSession } from '../src/features/generator';
import { inputFromProfile } from '../src/features/generator/fromProfile';
import { muscleFamily } from '../src/features/muscles';
import { initialOnboarding, type OnboardingData } from '../src/features/onboarding/store';
import { SHOULDER_PROGRAM } from '../src/features/rehab/programs';

jest.mock('expo-router', () => ({ router: {}, Redirect: () => null }));

type Reason = 'clips' | 'first_workout' | 'shoulder' | 'coverage';
export type LaunchSet = {
  _comment: string;
  exercises: { slug: string; reason: Reason }[];
};

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'supabase/seed/launch_set.json');
const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const MEDIA = join(ROOT, 'assets/prototype');
const qc = JSON.parse(readFileSync(join(MEDIA, 'qc.json'), 'utf8')) as {
  suspect?: Record<string, string>;
};
const files = new Set(readdirSync(MEDIA));
/** An approved clip of this sex (on disk and not a QC suspect). */
export const hasClip = (slug: string, sex: 'f' | 'm') =>
  files.has(`${slug}.${sex}.mp4`) && !qc.suspect?.[`${slug}.${sex}`];

const EQUIPMENT: Record<'home' | 'gym', OnboardingData['equipment'][]> = {
  home: [[], ['dumbbells'], ['chair', 'towel', 'long_bands']],
  gym: [['machines', 'dumbbells', 'barbell', 'cables', 'bench']],
};
const GOALS = ['look', 'lose_weight', 'strength', 'mobility', 'balance', 'fitness'] as const;
const MUSCLE_GOALS: OnboardingData['muscleGoals'][] = [
  [],
  [{ muscleKey: 'midChest', goal: 'grow' }],
  [{ muscleKey: 'glutes', goal: 'firm' }],
];

/** Every exercise a first workout can show: adult, teen and 60+ profiles. */
function firstWorkoutSlugs(): Set<string> {
  const out = new Set<string>();
  for (const birthYear of [1995, 1980, 2011, 1958, 1948])
    for (const sex of ['f', 'm'] as const)
      for (const location of ['home', 'gym'] as const)
        for (const equipment of EQUIPMENT[location])
          for (const minutes of [15, 30, 45])
            for (const goal of GOALS)
              for (const position of ['standing', 'with_support', 'seated_only'] as const)
                for (const muscleGoals of MUSCLE_GOALS) {
                  const p: OnboardingData = {
                    ...initialOnboarding(),
                    birthMonth: 5,
                    birthYear,
                    sex,
                    mainGoals: [goal],
                    location,
                    minutes,
                    daysPerWeek: 3,
                    equipment,
                    position,
                    muscleGoals,
                  };
                  const input = inputFromProfile(p, LIBRARY, true, {
                    today: '2026-10-01',
                    now: '2026-10-01T12:00:00Z',
                  });
                  if (!input) continue;
                  for (const item of generateSession(input).items)
                    out.add(byId.get(item.exerciseId)!.slug);
                }
  return out;
}

/** The muscles on the Exercises map (front and back), as their families. */
export const MAP_MUSCLES = [
  ...new Set([...GROUP_DOTS.front, ...GROUP_DOTS.back].map((d) => d.open)),
];
const trains = (e: Exercise, muscle: string) => {
  const family = new Set(muscleFamily(muscle).concat(muscle));
  return e.muscles.some((m) => m.role === 'primary' && family.has(m.muscleKey));
};
/** Main work only: warm-ups and stretches don't count as an option. */
const isMain = (e: Exercise) => e.parts.includes('main');

export function buildLaunchSet(): LaunchSet {
  const picked = new Map<string, Reason>();
  const add = (slug: string, reason: Reason) => {
    if (!picked.has(slug)) picked.set(slug, reason);
  };
  for (const e of LIBRARY) if (hasClip(e.slug, 'f') && hasClip(e.slug, 'm')) add(e.slug, 'clips');
  for (const slug of [...firstWorkoutSlugs()].sort()) add(slug, 'first_workout');
  for (const x of SHOULDER_PROGRAM.exercises) add(x.slug, 'shoulder');
  // The program's light mobility warm-up (Phase 32 B3).
  for (const w of SHOULDER_PROGRAM.warmup) add(w.slug, 'shoulder');

  const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
  const clipScore = (e: Exercise) => Number(hasClip(e.slug, 'f')) + Number(hasClip(e.slug, 'm'));
  for (const muscle of MAP_MUSCLES)
    for (const place of ['home', 'gym'] as const) {
      const fits = (e: Exercise) => isMain(e) && trains(e, muscle) && e.location.includes(place);
      const have = () => [...picked.keys()].filter((s) => fits(bySlug.get(s)!)).length;
      const candidates = LIBRARY.filter((e) => fits(e) && !picked.has(e.slug)).sort(
        (a, b) => clipScore(b) - clipScore(a) || a.level - b.level || a.slug.localeCompare(b.slug),
      );
      while (have() < 3 && candidates.length) add(candidates.shift()!.slug, 'coverage');
    }

  return {
    _comment:
      'Launch set for the professional review (Daniel, Oct 3). Generated by npm run launch-set; do not edit.',
    exercises: [...picked].map(([slug, reason]) => ({ slug, reason })),
  };
}

let cached: LaunchSet | undefined;
const launchSet = () => (cached ??= buildLaunchSet());

it('the committed launch set is up to date', () => {
  const set = launchSet();
  if (process.env.WRITE_LAUNCH_SET) writeFileSync(OUT, `${JSON.stringify(set, null, 2)}\n`);
  const committed = JSON.parse(readFileSync(OUT, 'utf8')) as LaunchSet;
  expect(committed).toEqual(set);
}, 120_000);

it('every muscle on the map has at least 3 options at home and 3 at the gym', () => {
  const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
  const set = launchSet().exercises.map((x) => bySlug.get(x.slug)!);
  const short = MAP_MUSCLES.flatMap((muscle) =>
    (['home', 'gym'] as const).flatMap((place) => {
      const n = set.filter(
        (e) => isMain(e) && trains(e, muscle) && e.location.includes(place),
      ).length;
      return n < 3 ? [`${muscle}/${place}: ${n}`] : [];
    }),
  );
  expect(short).toEqual([]);
}, 120_000);
