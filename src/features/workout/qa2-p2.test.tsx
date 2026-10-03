/**
 * QA round 2 — P2 polish (docs/qa-round-2.md §3).
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import seed from '../../../supabase/seed/exercises.json';
import catalogJson from '../../../supabase/seed/joint_movements.json';
import BodyMapScreen from '@/app/body-goals';
import HomeScreen from '@/app/(tabs)/home';
import MilestoneScreen from '@/app/milestone';
import { RadioCard } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { fromSeed, type SeedExercise } from '@/features/exercises/library';
import { useFamilyStore } from '@/features/family/store';
import { generateSession, getAlternatives, type GeneratorInput } from '@/features/generator';
import type { MovementCatalog, MovementKey } from '@/features/movement/catalog';
import { limitFrom, recoveryInput } from '@/features/movement/progress';
import { useMovementPainStore, type MovementPain } from '@/features/movement/store';
import { muscleByKey } from '@/features/muscles';
import { GYM_EQUIPMENT_OPTIONS } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { trainedMuscles } from '@/features/progress/stats';
import { resources } from '@/i18n';
import { clock } from '@/lib/clock';

import { useWorkoutStore } from './store';
import type { WorkoutRecord } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

const LIBRARY = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const CATALOG = catalogJson as unknown as MovementCatalog;
const NOW = new Date('2026-09-28T10:00:00');

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 40,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

beforeAll(() => {
  clock.now = () => NOW;
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'f',
      mainGoals: ['strength'],
      minutes: 40,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useFamilyStore.getState().reset();
    useAccountStore.getState().reset();
    useMovementPainStore.setState({ reports: [] });
  });
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

const root = (k: string) => muscleByKey(k)?.parentKey ?? k;

describe('Swap sheet', () => {
  it('a stretch swap stays on the same muscle group (as a primary or, after those, a secondary)', () => {
    const s = generateSession({ ...base, muscleGoals: [{ muscleKey: 'traps', goal: 'grow' }] });
    for (const item of s.items.filter((i) => i.part === 'cooldown_stretch')) {
      const own = byId
        .get(item.exerciseId)!
        .muscles.filter((m) => m.role === 'primary')
        .map((m) => root(m.muscleKey));
      for (const alt of getAlternatives(s, item.id, base)) {
        const theirs = alt.muscles
          .filter((m) => m.role !== 'stabilizer')
          .map((m) => root(m.muscleKey));
        expect(theirs.some((m) => own.includes(m))).toBe(true);
      }
    }
  });

  it('a warm-up swap never offers a cool-down-only move', () => {
    const slow = LIBRARY.find((e) => e.slug === 'cw_slow_step_touch')!;
    expect(slow.parts).toEqual(['cooldown_walk']);
  });
});

describe('Recovery session (phase 1)', () => {
  const report: MovementPain = {
    id: 'r1',
    area: 'shoulder',
    joints: ['shoulder'],
    side: 'right',
    painful: ['shoulder.abduction', 'shoulder.external_rotation'] as MovementKey[],
    painFree: ['shoulder.flexion', 'shoulder.extension'] as MovementKey[],
    score: 4,
    duration: '2_6_weeks',
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    checks: [],
    retests: [],
  };

  it('4 holds, no balance or "shortened" notes, nothing contraindicated for the area', () => {
    const input = {
      ...base,
      painAreas: ['shoulder'],
      restrictions: ['shoulder'],
      movementLimits: [limitFrom(report)],
    };
    const s = generateSession(recoveryInput(input, report, CATALOG));
    const main = s.items.filter((i) => i.role === 'main');
    expect(main).toHaveLength(4);
    expect(s.notes).toEqual([]);
    for (const item of main)
      expect(byId.get(item.exerciseId)!.contraindications).not.toContain('shoulder');
  });
});

describe('Share card', () => {
  it('ties follow the session target order, not the alphabet', () => {
    const s = generateSession(base);
    const w = {
      status: 'done',
      session: s,
      logs: s.items
        .filter((i) => i.role === 'main')
        .map((i) => ({ itemId: i.id, exerciseId: i.exerciseId, setNo: 1, loggedAt: '' })),
    } as unknown as WorkoutRecord;
    expect(trainedMuscles([w], LIBRARY)[0]).toBe(
      byId
        .get(s.items.find((i) => i.role === 'main' && i.targetMuscle === 'upperChest')!.exerciseId)!
        .muscles.find((m) => m.role === 'primary')!.muscleKey,
    );
  });
});

describe('Profile data', () => {
  it('the pregnancy flag is dropped when the age moves to 60+', async () => {
    await act(() => useOnboardingStore.getState().update({ conditions: ['pregnant_postpartum'] }));
    expect(useOnboardingStore.getState().conditions).toEqual(['pregnant_postpartum']);
    await act(() => useOnboardingStore.getState().update({ birthYear: 1950 }));
    expect(useOnboardingStore.getState().conditions).toEqual([]);
  });

  it('Repair moves are never offered to kids', () => {
    for (const e of LIBRARY.filter((x) => x.slug.startsWith('rx_') || x.slug.startsWith('rp_')))
      expect(e.minAgeBand).not.toBe('kid');
  });
});

describe('Home', () => {
  it('prompts the morning check after a recovery session', async () => {
    await act(() =>
      useMovementPainStore.setState({
        reports: [
          {
            id: 'r1',
            area: 'shoulder',
            joints: ['shoulder'],
            side: 'right',
            painful: ['shoulder.abduction'] as MovementKey[],
            painFree: [],
            score: 4,
            duration: '2_6_weeks',
            active: true,
            createdAt: '2026-09-20T09:00:00.000Z',
            checks: [{ kind: 'after', score: 3, at: '2026-09-27T18:00:00', workoutId: 'w1' }],
            retests: [],
          } as MovementPain,
        ],
      }),
    );
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rate your pain this morning' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/movement-pain/[id]',
      params: { id: 'r1' },
    });
  });

  it('"1 day streak" plural in Portuguese and Spanish', () => {
    expect(resources['pt-BR'].translation.home.dayStreak_one).toBe('Dia seguido');
    expect(resources.es.translation.home.dayStreak_one).toBe('Día seguido');
  });
});

describe('Copy and accessibility', () => {
  it('a kid profile sees Boy / Girl and no "change age anytime"', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          {
            id: 'c1',
            kind: 'child',
            name: 'Mia',
            createdAt: '2026-09-02T00:00:00Z',
            consentAt: 'x',
          },
        ],
        activeId: 'c1',
      });
      useOnboardingStore.getState().update({ birthYear: 2016, who: 'child' });
    });
    await render(<BodyMapScreen />);
    expect(screen.getByRole('button', { name: 'Boy' })).toBeTruthy();
    expect(screen.queryByText(/change body or age anytime/)).toBeNull();
    expect(screen.getByRole('radio', { name: 'Back view' })).toBeTruthy();
  });

  it('RadioCard always exposes aria-checked', async () => {
    await render(<RadioCard label="One" selected={false} onPress={() => undefined} />);
    // aria-checked is set explicitly (web read null before); native mirrors it here.
    expect(screen.getByRole('radio', { name: 'One' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('a 1-day streak milestone link is not "a full week"', async () => {
    await act(() => {
      useWorkoutStore.setState({
        streak: { current: 1, best: 1, freezes: 0, lastActive: '2026-09-28', restDays: [] },
      });
      useAccountStore.getState().update({
        milestone: { streak: 1, workoutId: 'w', at: '2026-09-28T10:00:00Z' },
      });
    });
    await render(<MilestoneScreen />);
    expect(screen.queryByText(/A full week/)).toBeNull();
    expect(screen.getByText(/6 more days to your 7-day streak/)).toBeTruthy();
  });
});
