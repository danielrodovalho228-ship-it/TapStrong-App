/**
 * Phase 32 B (Daniel's Android test, Oct 4): the plan tab with the shoulder
 * program as the main plan (its week, today's list, "N exercises · X min"),
 * three-letter weekdays, a warm-up that never locks ("Skip warm-up"), the
 * painted shoulder on the player and "Demo coming soon" off the picture.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import PlayerScreen from '@/app/workout/[id]/play';
import { workedAreas } from '@/features/bodymap/components/MuscleAreaMap';
import { useOnboardingStore } from '@/features/onboarding/store';
import { weekdayShort } from '@/features/program/components/WeekStrip';
import { buildProgramSession, SHOULDER_PROGRAM as P } from '@/features/rehab/programs';
import { useRehabStore } from '@/features/rehab/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { useWorkoutStore } from '../workout/store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;
jest.setTimeout(30_000);

const LIBRARY = devLibrary();
const TODAY = '2026-10-05';
beforeAll(() => {
  clock.now = () => new Date(`${TODAY}T12:00:00`);
});

async function adult(clearance: 'yes' | 'unsure' | null) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1985,
      sex: 'f',
      mainGoals: ['mobility'],
      minutes: 30,
      onboardingComplete: true,
      units: 'metric',
    });
    useOnboardingStore.getState().setLocation('home');
    useWorkoutStore.getState().reset();
    useRehabStore.getState().reset();
    if (clearance !== null) useRehabStore.getState().start(P.id, 'right', TODAY, 'now', clearance);
  });
  Object.values(mockRouter).forEach((f) => f.mockReset?.());
}

describe('the plan tab with the shoulder program (B7)', () => {
  it('the shoulder is the main plan: its week, today’s list with the summary line, its Start', async () => {
    await adult('unsure');
    await render(<HomeScreen />);
    const main = screen.getByTestId('shoulder-main');
    expect(within(main).getByText('Week 1 of 6 · Shoulder')).toBeTruthy();
    // "Not sure" about the physio: mobility only.
    expect(within(main).getByText('Mobility')).toBeTruthy();
    const summary = within(main).getByTestId('shoulder-summary');
    expect(summary).toHaveTextContent(/\d+ exercises/);
    expect(summary).toHaveTextContent(/\d+ min/);
    // The list is there (cards with posters or the body), not only a card.
    expect(within(main).getAllByLabelText(/Crossover/).length).toBeGreaterThan(0);
    // No second "Shoulder today" card: it is the plan itself.
    expect(screen.queryByTestId(`care-home-${P.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('start-shoulder'));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.kind).toBe('repair');
    expect(w.session.items.every((i) => i.block === 'stretch')).toBe(true);
  });

  it('without the shoulder program the regular plan stays the main one', async () => {
    await adult(null);
    await render(<HomeScreen />);
    expect(screen.queryByTestId('shoulder-main')).toBeNull();
  });

  it('weekdays have three letters: "dom seg ter qua qui sex sáb", never "qu qu se se"', () => {
    const week = (lang: string) =>
      Array.from({ length: 7 }, (_, i) => weekdayShort(new Date(2026, 8, 20 + i, 12), lang));
    for (const lang of ['pt-BR', 'es', 'en']) {
      const days = week(lang);
      expect(new Set(days).size).toBe(7);
      for (const d of days) expect(d.length).toBeGreaterThanOrEqual(3);
    }
    expect(week('pt-BR').slice(1, 6)).toEqual(['seg', 'ter', 'qua', 'qui', 'sex']);
  });
});

describe('the warm-up never locks (B2) and the player (B6)', () => {
  async function playB() {
    await adult('yes');
    const session = buildProgramSession(P, 'B', { library: LIBRARY, affected: 'right', week: 1 });
    let id = '';
    await act(() => {
      id = useWorkoutStore.getState().create(session, 'repair');
      useWorkoutStore.getState().start(id);
    });
    mockParams = { id };
    return id;
  }

  it('"Skip warm-up" is always there; Done is never disabled', async () => {
    const id = await playB();
    await render(<PlayerScreen />);
    const done = screen.getByTestId('guided-done');
    expect(done.props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(screen.getByTestId('guided-skip-warmup'));
    const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
    const warm = w.session.items.filter((i) => i.role === 'warmup').map((i) => i.id);
    expect(warm.length).toBe(3);
    for (const itemId of warm) expect(w.skipped).toContain(itemId);
  });

  it('no clip yet: "Demo coming soon" is not on the media (the body sits in the top third)', async () => {
    await playB();
    await render(<PlayerScreen />);
    const frame = screen.getByTestId('demo-frame');
    expect(within(frame).queryByText('Demo coming soon')).toBeNull();
  });

  it('the rotator cuff paints the whole shoulder, front and back, never a dot', () => {
    expect(workedAreas(['rotatorCuff'], []).main).toEqual(['shoulders', 'rearDelts']);
  });
});
