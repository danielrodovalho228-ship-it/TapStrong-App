/**
 * Phase 32 (Daniel, Oct 3): only released exercises reach users. The store
 * build reads them from Supabase and keeps them on the phone; a released row
 * wins over its draft in a dev build; "checked by a certified coach" only for
 * released exercises; and a muscle with fewer than 3 options says so instead
 * of inventing one.
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import MuscleExercisesScreen from '@/app/muscle/[key]';
import { useOnboardingStore } from '@/features/onboarding/store';

import { devLibrary, type ExerciseRow } from '../exercises/library';
import { currentLibrary, mergeLibrary, useReleasedLibraryStore } from '../exercises/released';
import { isReviewed } from '../workout/plan';
import type { GeneratedSession } from '../generator/types';

let mockParams: Record<string, string> = {};
jest.setTimeout(30_000);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const trainsBiceps = (e: (typeof LIBRARY)[number]) =>
  e.muscles.some((m) => m.role === 'primary' && m.muscleKey === 'biceps');
// Only two biceps exercises left: fewer than 3 options.
const mockFew = [
  ...LIBRARY.filter((e) => !trainsBiceps(e)),
  ...LIBRARY.filter(trainsBiceps).slice(0, 2),
];
jest.mock('@/features/workout/hooks', () => ({
  ...jest.requireActual('@/features/workout/hooks'),
  useExerciseLibrary: () => mockFew,
}));

/** A released Supabase row for a seed exercise. */
function rowFor(slug: string, status = 'released'): ExerciseRow {
  const e = LIBRARY.find((x) => x.slug === slug)!;
  return {
    id: `uuid-${slug}`,
    slug,
    name_i18n_key: e.nameKey,
    cues_i18n_key: e.cuesKey,
    equipment: e.equipment,
    location: e.location,
    level: e.level,
    min_age_band: e.minAgeBand,
    positions: e.positions,
    contraindications: e.contraindications,
    movement_pattern: e.pattern,
    session_parts: e.parts,
    dose_type: e.dose,
    loaded: e.loaded,
    unilateral: e.unilateral,
    impact: e.impact,
    status,
    media_video: `exercise-media/${slug}`,
    media_poster: `exercise-media/posters/${slug}`,
    media_provider: 'google_flow',
    exercise_muscles: e.muscles.map((m) => ({
      muscle_key: m.muscleKey,
      role: m.role,
      emphasis: m.emphasis,
    })),
  };
}

describe('the released library', () => {
  const [a, b] = LIBRARY;

  it('a store build (no drafts) has exactly the released rows', () => {
    const lib = mergeLibrary([], [rowFor(a.slug), rowFor(b.slug, 'draft')]);
    expect(lib.map((e) => e.slug)).toEqual([a.slug]);
    expect(lib[0].status).toBe('released');
    expect(lib[0].id).toBe(`uuid-${a.slug}`);
  });

  it('in a dev build a released row replaces its draft and keeps the draft id', () => {
    const lib = mergeLibrary(LIBRARY, [rowFor(a.slug)]);
    expect(lib).toHaveLength(LIBRARY.length);
    const merged = lib.find((e) => e.slug === a.slug)!;
    expect(merged.status).toBe('released');
    expect(merged.id).toBe(a.id);
  });

  it('kept on the phone: currentLibrary reads the saved copy', async () => {
    await act(() => useReleasedLibraryStore.getState().set([rowFor(a.slug)], '2026-10-03'));
    expect(currentLibrary().find((e) => e.slug === a.slug)!.status).toBe('released');
    await act(() => useReleasedLibraryStore.getState().set([], '2026-10-03'));
  });

  it('"checked by a certified coach" only when every exercise is released', () => {
    const lib = mergeLibrary(LIBRARY, [rowFor(a.slug)]);
    const session = (ids: string[]) =>
      ({ items: ids.map((exerciseId) => ({ exerciseId })) }) as unknown as GeneratedSession;
    expect(isReviewed(session([a.id]), lib)).toBe(true);
    expect(isReviewed(session([a.id, b.id]), lib)).toBe(false);
  });
});

it('a muscle with fewer than 3 options says more are coming, never invents one', async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 40,
      onboardingComplete: true,
      safetyDone: true,
    });
    useOnboardingStore.getState().setLocation('gym');
  });
  mockParams = { key: 'biceps' };
  await render(<MuscleExercisesScreen />);
  expect(screen.getByTestId('muscle-few')).toBeTruthy();
  expect(screen.queryAllByTestId('muscle-card').length).toBeLessThan(3);
});
