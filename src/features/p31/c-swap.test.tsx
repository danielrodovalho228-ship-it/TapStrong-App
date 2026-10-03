/**
 * Phase 31, package C: the "SWAP EXERCISE" sheet — "Same muscle" first, then
 * "Other options", "More" at the end; the person's equipment only; the (i)
 * opens the exercise; a swap replaces, never adds.
 */
import '@/i18n';

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import { alternativeGroups, generateSession, getAlternatives } from '../generator';
import type { GeneratorInput } from '../generator/types';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { SwapSheet } from '../workout/components/SwapSheet';
import { useWorkoutStore } from '../workout/store';
import type { WorkoutRecord } from '../workout/types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
}));
const router = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'chest', goal: 'grow' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-10-01',
  now: '2026-10-01T12:00:00Z',
};

describe('alternativeGroups', () => {
  const session = generateSession(base);
  const main = session.items.find((i) => i.role === 'main')!;
  const groups = alternativeGroups(session, main.id, base);
  const all = [...groups.same, ...groups.other, ...groups.more];

  it('same muscle first, then other options, then more; no repeats, none from the session', () => {
    expect(groups.same.length).toBeGreaterThan(0);
    expect(groups.same.length).toBeLessThanOrEqual(5);
    expect(groups.other.length).toBeLessThanOrEqual(5);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    const inSession = new Set(session.items.map((i) => i.exerciseId));
    for (const e of all) expect(inSession.has(e.id)).toBe(false);
    // The old list is still the first options of the sheet.
    expect(getAlternatives(session, main.id, base).map((e) => e.id)).toEqual(
      expect.arrayContaining(groups.same.slice(0, 3).map((e) => e.id)),
    );
  });

  it('only the equipment the person marked', () => {
    const home: GeneratorInput = { ...base, location: 'home', equipment: ['dumbbells'] };
    const s = generateSession(home);
    for (const item of s.items.filter((i) => i.role === 'main')) {
      const g = alternativeGroups(s, item.id, home);
      for (const e of [...g.same, ...g.other, ...g.more])
        expect([e.id, e.equipment.every((q) => ['dumbbells'].includes(q))]).toEqual([e.id, true]);
    }
  });
});

describe('the sheet', () => {
  function workout(): WorkoutRecord {
    return {
      id: 'w',
      kind: 'regular',
      status: 'planned',
      createdAt: '2026-10-01T09:00:00',
      session: generateSession(base),
      logs: [],
      skipped: [],
      swaps: [],
      pains: [],
    };
  }

  it('title, sections, (i) and a swap that replaces in place', async () => {
    const w = workout();
    useWorkoutStore.setState({ workouts: [w] });
    const main = w.session.items.find((i) => i.role === 'main')!;
    const onClose = jest.fn();
    await render(
      <SwapSheet
        visible
        workout={w}
        itemId={main.id}
        reason="user_choice"
        input={base}
        byId={byId}
        onPickItem={() => undefined}
        onClose={onClose}
        onSwapped={() => undefined}
      />,
    );
    expect(screen.getByRole('header', { name: 'SWAP EXERCISE' })).toBeTruthy();
    const same = screen.getByTestId('swap-group-same');
    expect(within(same).getByText('Same muscle')).toBeTruthy();
    const more = screen.queryByTestId('swap-group-more');
    if (more) {
      const rowsBefore = screen.getAllByTestId('swap-option').length;
      await fireEvent.press(within(more).getByText(/^More \(\d+\)$/));
      expect(screen.getAllByTestId('swap-option').length).toBeGreaterThan(rowsBefore);
    }
    await fireEvent.press(screen.getAllByRole('button', { name: /^About / })[0]);
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/exercise/[id]' }),
    );
    // Ramp-up sets follow the new exercise; the exercises never grow.
    const mains = (x: WorkoutRecord) => x.session.items.filter((i) => i.role === 'main').length;
    const count = mains(w);
    await fireEvent.press(within(same).getAllByTestId('swap-option')[0]);
    const after = useWorkoutStore.getState().workouts[0];
    expect(mains(after)).toBe(count);
    expect(after.swaps).toHaveLength(1);
  });
});
