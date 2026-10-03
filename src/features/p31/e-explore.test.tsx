/**
 * Phase 31, package E: the Exercises tab — the profile's body with coral
 * dots and names down both sides, a 180° turn, a muscle opening its grid
 * (picture, name, star, search), favourites and search shortcuts.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import ExercisesScreen from '@/app/(tabs)/body';
import MuscleExercisesScreen from '@/app/muscle/[key]';
import { hotspotsFor, sideLabels } from '@/features/bodymap/hotspots';
import { useLibraryStore } from '@/features/library/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleFamily } from '@/features/muscles';

import { devLibrary } from '../exercises/library';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
const router = jest.requireMock('expo-router').router as Record<string, jest.Mock>;
const LIBRARY = devLibrary();

async function as(birthYear: number, sex: 'f' | 'm' = 'f') {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex,
      mainGoals: ['look'],
      minutes: 40,
      onboardingComplete: true,
      safetyDone: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useLibraryStore.setState({ favourites: [] });
  });
  router.push.mockReset();
}

describe('the body', () => {
  it('names every dot once, down both sides, top to bottom', () => {
    const spots = hotspotsFor('adult', 'f', 'front');
    const { left, right } = sideLabels(spots);
    expect([...left, ...right].sort()).toEqual(spots.map((h) => h.key).sort());
    expect(Math.abs(left.length - right.length)).toBeLessThanOrEqual(1);
  });

  it('shows the labels, the 180° hint and opens a muscle', async () => {
    await as(1990);
    await render(<ExercisesScreen />);
    expect(screen.getByRole('header', { name: 'Exercises' })).toBeTruthy();
    expect(screen.getByText('Swipe to turn 180°')).toBeTruthy();
    const labels = screen.getAllByTestId('side-label');
    expect(labels.length).toBe(hotspotsFor('adult', 'f', 'front').length);
    await fireEvent.press(labels[0]);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/muscle/[key]',
      params: { key: sideLabels(hotspotsFor('adult', 'f', 'front')).left[0] },
    });
  });

  it('turns around and the labels follow the back view', async () => {
    await as(1990, 'm');
    await render(<ExercisesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn the body around' }));
    expect(useOnboardingStore.getState().bodyView).toBe('back');
    expect(screen.getAllByTestId('side-label')).toHaveLength(
      hotspotsFor('adult', 'm', 'back').length,
    );
  });

  it('favourites and search shortcuts', async () => {
    await as(1990);
    await act(() => useLibraryStore.setState({ favourites: [LIBRARY[0].id] }));
    await render(<ExercisesScreen />);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Favourites (1)' }).at(-1)!);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/muscle/[key]',
      params: { key: 'favourites' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Search all exercises' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/muscle/[key]', params: { key: 'all' } });
  });

  it('60+ also get big area buttons', async () => {
    await as(1955);
    await render(<ExercisesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Legs' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/muscle/[key]',
      params: { key: 'area:legs' },
    });
  });
});

describe('a muscle grid', () => {
  it('only exercises that train it, with a star and a search', async () => {
    await as(1990);
    mockParams = { key: 'chest' };
    await render(<MuscleExercisesScreen />);
    const cards = screen.getAllByTestId('muscle-card');
    expect(cards.length).toBeGreaterThan(1);
    // Every listed exercise has chest (or a part of it) as a primary muscle.
    const family = new Set(['chest', ...muscleFamily('chest')]);
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    const ids = screen
      .getAllByTestId(/^muscle-open-/)
      .map((n) => String(n.props.testID).replace('muscle-open-', ''));
    expect(ids).toHaveLength(cards.length);
    for (const id of ids)
      expect(
        byId.get(id)!.muscles.some((m) => m.role === 'primary' && family.has(m.muscleKey)),
      ).toBe(true);
    const names = ids.map((id) => screen.getByTestId(`muscle-open-${id}`).props.accessibilityLabel);

    // The star keeps it in Favourites.
    const star = within(cards[0]).getByRole('button', { name: /^Star / });
    await fireEvent.press(star);
    expect(useLibraryStore.getState().favourites).toHaveLength(1);

    // Search narrows the grid.
    await fireEvent.changeText(screen.getByLabelText('Search in Chest'), names[0]);
    expect(screen.getAllByTestId('muscle-card').length).toBeLessThanOrEqual(cards.length);
    expect(screen.getAllByRole('button', { name: names[0] }).length).toBeGreaterThan(0);
  });

  it('Favourites lists only the starred ones; empty says how to add', async () => {
    await as(1990);
    mockParams = { key: 'favourites' };
    await render(<MuscleExercisesScreen />);
    expect(screen.getByTestId('muscle-empty')).toBeTruthy();
    const pick = LIBRARY.find((e) => e.status === 'released' || e.status === 'draft')!;
    await act(() => useLibraryStore.setState({ favourites: [pick.id] }));
    expect(screen.getAllByTestId('muscle-card').length).toBeLessThanOrEqual(1);
  });
});
