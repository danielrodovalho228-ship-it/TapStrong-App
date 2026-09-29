import { normalizeEquipment } from '../equipment/catalog';
/**
 * QA round 1 — P1 logic and UX fixes (docs/qa-round-1.md §2).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FamilyScreen from '@/app/(tabs)/family';
import BillingScreen from '@/app/billing';
import { devLibrary } from '@/features/exercises/library';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { useFamilyStore } from '@/features/family/store';
import { levelFor, lightHistory } from '@/features/movement/progress';
import type { MovementPain } from '@/features/movement/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { withRestriction } from '@/features/workout/pain';
import { sessionTargets } from '@/features/workout/plan';
import { resources } from '@/i18n';
import { clock } from '@/lib/clock';

import { getAlternatives } from './alternatives';
import { doseFor } from './dosage';
import { blockReason } from './filters';
import { generateSession } from './generate';
import type { GeneratorInput } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

const LIBRARY = devLibrary();
const ex = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: normalizeEquipment([
    'dumbbells',
    'bands',
    'machines',
    'cables',
    'bench',
    'barbell',
    'mat',
  ]),
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
  exercisesPerSession: 3,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

beforeAll(() => {
  clock.now = () => new Date('2026-09-27T12:00:00Z');
});

describe('Senior / 60+', () => {
  it('B-08/C-06 balance work is held and seniors always get some', () => {
    const d = doseFor('strengthen', 'senior', ex('single_leg_balance'), 3);
    expect(d.holdSeconds).toEqual([20, 40]);
    expect(d.reps).toBeUndefined();
    const s = generateSession({
      ...base,
      mode: 'senior',
      band: 'senior',
      location: 'home',
      equipment: [],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      conditions: ['fell_last_year'],
    });
    expect(main(s).some((i) => ex(i.exerciseId).pattern === 'balance')).toBe(true);
  });

  it('C-09 heart condition: moderate reps, no heavy sets, no ramp-up', () => {
    const press = ex('flat_dumbbell_press');
    expect(doseFor('strengthen', 'adult', press, 3, { caution: true })).toMatchObject({
      reps: [10, 15],
      loadHint: 'moderate',
    });
    const s = generateSession({
      ...base,
      muscleGoals: [{ muscleKey: 'midChest', goal: 'strengthen' }],
      conditions: ['high_blood_pressure'],
    });
    expect(s.items.some((i) => i.part === 'ramp_up')).toBe(false);
    expect(s.items.some((i) => i.loadHint === 'heavy')).toBe(false);
  });
});

describe('Movement that hurts', () => {
  const report = (patch: Partial<MovementPain> = {}): MovementPain => ({
    id: 'r',
    area: 'shoulder',
    joints: ['shoulder'],
    painful: ['shoulder.abduction'],
    painFree: ['shoulder.push'],
    score: 4,
    duration: '2_6_weeks',
    active: true,
    createdAt: '2026-09-01T00:00:00Z',
    checks: [],
    retests: [],
    ...patch,
  });

  it('A-04 the morning is compared with the rating just before it, and green moves on', () => {
    const r = report({
      score: 6,
      checks: [
        { workoutId: 'w', kind: 'after', score: 2, at: '2026-09-02T18:00:00Z' },
        { workoutId: 'w', kind: 'morning', score: 3, at: '2026-09-03T08:00:00Z' },
      ],
    });
    expect(lightHistory(r)[0].light).toBe('green');
    expect(levelFor(r)).toBe(2);
    const worse = report({
      checks: [
        { workoutId: 'w', kind: 'after', score: 1, at: '2026-09-02T18:00:00Z' },
        { workoutId: 'w', kind: 'morning', score: 3, at: '2026-09-03T08:00:00Z' },
      ],
    });
    expect(lightHistory(worse)[0].light).toBe('red');
  });

  it('A-05 pain right now beats the pain-free list; bodyweight is never "heavy"', () => {
    const limits = [
      {
        area: 'shoulder',
        joints: ['shoulder' as const],
        painful: ['shoulder.abduction' as const],
        painFree: ['shoulder.push' as const],
        score: 3,
      },
    ];
    const input = { ...base, movementLimits: limits };
    expect(blockReason(ex('push_up'), input)).toBeNull();
    expect(blockReason(ex('push_up'), withRestriction(input, 'shoulder'))).toBe('contraindication');
    expect(doseFor('strengthen', 'adult', ex('push_up'), 3).loadHint).toBe('bodyweight');
    expect(doseFor('strengthen', 'adult', ex('push_up'), 3).reps).toEqual([8, 12]);
  });
});

describe('C-10 pregnancy is dropped when the body is male', () => {
  it('clears the hidden condition', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ sex: 'f', conditions: ['pregnant_postpartum', 'diabetes'] });
      useOnboardingStore.getState().update({ sex: 'm' });
    });
    expect(useOnboardingStore.getState().conditions).toEqual(['diabetes']);
  });
});

describe('Generator and home', () => {
  it('D-01 the Home card names what the session trains', () => {
    const s = generateSession(base);
    expect(sessionTargets(s)).toEqual([...new Set(main(s).map((i) => i.targetMuscle))].slice(0, 2));
  });

  it('D-03 chest parts count as one muscle for "max 2 days in a row"', () => {
    const s = generateSession({
      ...base,
      muscleGoals: [
        { muscleKey: 'lowerChest', goal: 'grow' },
        { muscleKey: 'lats', goal: 'grow' },
      ],
      recentSessions: [
        { date: '2026-09-26', mainMuscles: ['upperChest'] },
        { date: '2026-09-25', mainMuscles: ['midChest'] },
      ],
      today: '2026-09-27',
    });
    expect(main(s).some((i) => i.targetMuscle === 'lowerChest')).toBe(false);
  });

  it('D-04 every chosen muscle takes its turn: the least recently trained comes first', () => {
    const s = generateSession({
      ...base,
      exercisesPerSession: 1,
      muscleGoals: [
        { muscleKey: 'upperChest', goal: 'grow' },
        { muscleKey: 'upperAbs', goal: 'grow' },
      ],
      recentSessions: [{ date: '2026-09-25', mainMuscles: ['upperChest'] }],
      today: '2026-09-27',
    });
    expect(main(s)[0].targetMuscle).toBe('upperAbs');
  });

  it('D-02 "sets each" is honored', () => {
    const s = generateSession({ ...base, setsPerExercise: 5 });
    expect(main(s)[0].sets).toBe(5);
  });

  it('A-07 the promised cardio finisher appears for "look better"', () => {
    const s = generateSession({ ...base, mainGoals: ['look'], minutes: 40 });
    expect(s.items.some((i) => i.part === 'finisher_cardio')).toBe(true);
  });

  it('A-11 warm-up and cool-down swaps stay in the same body region', () => {
    const s = generateSession(base);
    const stretch = s.items.find((i) => i.part === 'cooldown_stretch')!;
    const region = (slug: string) =>
      ex(slug)
        .muscles.filter((m) => m.role === 'primary')
        .map((m) => m.muscleKey);
    const upper = new Set([
      'chest',
      'upperChest',
      'midChest',
      'lowerChest',
      'shoulders',
      'rearDelts',
      'triceps',
      'biceps',
      'forearms',
      'traps',
      'upperBack',
      'lats',
    ]);
    const isUpper = region(stretch.exerciseId).some((m) => upper.has(m));
    for (const alt of getAlternatives(s, stretch.id, base)) {
      expect(region(alt.slug).some((m) => upper.has(m))).toBe(isUpper);
    }
  });
});

describe('Family and children', () => {
  it('B-03 a child profile needs the parent gate for billing', async () => {
    await act(() =>
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: 'x' },
          { id: 'c', kind: 'child', createdAt: 'x', consentAt: 'x' },
        ],
        activeId: 'c',
      }),
    );
    await render(<BillingScreen />);
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
  });

  it('B-03 a managed 60+ profile never sees owner controls', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: 'x' },
          { id: 'g', kind: 'parent', createdAt: 'x' },
        ],
        activeId: 'g',
      });
      // As a real switch leaves it: the secure record follows the active
      // profile. (A stale secure id from an earlier test showed the PIN
      // gate instead — order-dependent, QA R9 P2; not an app path.)
      useOwnerIdentityStore.setState({ ownerId: 'me', activeId: 'g', minors: {} });
    });
    await render(<BillingScreen />);
    expect(screen.getAllByText(/The account owner manages/).length).toBeGreaterThan(0);
  });

  it('A-10 the Family tab registers the owner after render, not during it', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(() => useFamilyStore.getState().reset());
    await render(<FamilyScreen />);
    expect(useFamilyStore.getState().profiles.map((p) => p.kind)).toEqual(['self']);
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringMatching(/Cannot update a component/),
      expect.anything(),
    );
    spy.mockRestore();
  });

  it('B-03 switching from a child profile asks for the parent gate', async () => {
    await act(() =>
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: 'x' },
          { id: 'c', kind: 'child', name: 'Mia', createdAt: 'x', consentAt: 'x' },
        ],
        activeId: 'c',
      }),
    );
    await render(<FamilyScreen />);
    await fireEvent.press(screen.getAllByRole('button', { name: /Switch to/ })[0]);
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    expect(useFamilyStore.getState().activeId).toBe('c');
  });
});

describe('Other P1s', () => {
  it('A-09 Spanish dull pain reads as dull, not sharp', () => {
    const walk = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : walk(v as object)));
    expect(walk(resources.es.translation)).toContain('Molestia sorda / incomodidad');
    expect(walk(resources.es.translation).some((v) => v.includes('pinchazo'))).toBe(false);
  });
});
