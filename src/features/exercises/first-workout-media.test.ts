import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import seed from '../../../supabase/seed/exercises.json';

import { generateSession } from '../generator';
import { inputFromProfile } from '../generator/fromProfile';
import { initialOnboarding, type OnboardingData } from '../onboarding/store';

import { fromSeed, type SeedExercise } from './library';

/**
 * Phase 29, A1: every exercise a first workout can show without a clip of the
 * profile's sex is listed in assets/prototype/qc.json (so media-redo puts it
 * on top as "faltando, prioridade alta: aparece no primeiro treino").
 */
const LIBRARY = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const DIR = join(__dirname, '../../../assets/prototype');
const clips = new Set(
  readdirSync(DIR)
    .filter((n) => /^[a-z0-9_]+\.(f|m)\.mp4$/.test(n))
    .map((n) => n.replace(/\.mp4$/, '')),
);
const qc = JSON.parse(readFileSync(join(DIR, 'qc.json'), 'utf8')) as {
  missing?: Record<string, string>;
  otherSex?: Record<string, string>;
};

const EQUIPMENT: Record<'home' | 'gym', OnboardingData['equipment'][]> = {
  home: [[], ['dumbbells'], ['chair', 'towel', 'long_bands']],
  gym: [['machines', 'dumbbells', 'barbell', 'cables', 'bench']],
};

const MUSCLE_GOALS: OnboardingData['muscleGoals'][] = [
  [],
  [{ muscleKey: 'midChest', goal: 'grow' }],
  [{ muscleKey: 'glutes', goal: 'firm' }],
];

/** First-workout slugs without a clip, as "<slug>.<f|m>". */
export function firstWorkoutGaps(): string[] {
  const gaps = new Set<string>();
  for (const birthYear of [1995, 1980, 1958, 1948])
    for (const sex of ['f', 'm'] as const)
      for (const location of ['home', 'gym'] as const)
        for (const equipment of EQUIPMENT[location])
          for (const minutes of [15, 30, 45])
            for (const goal of [
              'look',
              'lose_weight',
              'strength',
              'mobility',
              'balance',
              'fitness',
            ] as const)
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
                  for (const item of generateSession(input).items) {
                    const key = `${byId.get(item.exerciseId)!.slug}.${sex}`;
                    if (!clips.has(key) && !qc.otherSex?.[key]) gaps.add(key);
                  }
                }
  return [...gaps].sort();
}

it('lists every first-workout exercise without a clip in qc.json', () => {
  const gaps = firstWorkoutGaps();
  if (process.env.PRINT_GAPS) console.log(JSON.stringify(gaps));
  expect(gaps.filter((k) => !qc.missing?.[k])).toEqual([]);
}, 60_000);
