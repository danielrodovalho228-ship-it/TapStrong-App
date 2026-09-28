/**
 * QA round 4 — safety P1: lower-back and knee tag gaps with an audit
 * (R4-01, R4-02), custom exercises through the same checks (R4-03), no
 * adult-only plans for teens (R4-04), and the profile-kind protection gaps
 * (R4-05).
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import WhoScreen from '@/app/onboarding/who';
import ProgramScreen from '@/app/program/[id]';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import {
  isOwnerProfile,
  minorLockFor,
  useOwnerIdentityStore,
} from '@/features/family/ownerIdentity';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { customToExercise } from '@/features/library/custom';
import type { CustomExerciseData } from '@/features/library/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { programStatus, withProgram } from '@/features/program/apply';
import { planAllowed, planById, READY_PLANS } from '@/features/program/plans';
import { useProgramStore } from '@/features/program/store';
import { clock } from '@/lib/clock';

import seed from '../../../supabase/seed/exercises.json';
import type { SeedExercise } from '../exercises/library';
import { fromSeed } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';

import { blockReason } from './filters';
import type { GeneratorInput } from './types';

let mockId = 'weightLoss-fullBody-3';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: mockId, edit: '1' }),
  Redirect: () => null,
}));

const RAW = seed.exercises as SeedExercise[];
const LIBRARY = RAW.map(fromSeed);
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const NOW = new Date('2026-09-28T12:00:00Z');

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
  muscleGoals: [],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

beforeAll(() => {
  clock.now = () => NOW;
});

describe('R4-01 / R4-02 joint tag audit', () => {
  const LEG = ['quads', 'hamstrings', 'glutes', 'calves', 'shins', 'knees'];
  const LOCO = ['squat', 'lunge', 'balance', 'calf', 'ankle'];
  const primary = (e: SeedExercise) =>
    e.muscles.filter((m) => m[1] === 'primary').map((m) => m[0] as string);
  const joints = (e: SeedExercise) => new Set(e.joints.map((j) => j[0] as string));
  // Done seated or lying without loading the legs, or a passive stretch.
  const offLegs = (e: SeedExercise) =>
    /seated|side_lying|clamshell|supine|lying/.test(e.slug) ||
    e.pattern === 'stretch' ||
    e.pattern === 'breathing';

  it('every lower-back move and every plank or loaded hold carries the lower back', () => {
    const missing = RAW.filter(
      (e) =>
        (primary(e).includes('lowerBack') || e.slug.includes('plank')) &&
        !joints(e).has('lower_back') &&
        !e.contraindications.includes('lower_back'),
    ).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it('every leg, standing locomotion, single-leg or carry move carries the knee', () => {
    const missing = RAW.filter((e) => {
      const single = e.joints.some((j) => j[0] === 'hip' && j[1] === 'single_leg');
      const carry =
        e.pattern !== 'shoulder_isolation' &&
        e.joints.some((j) => j[0] === 'shoulder' && j[1] === 'carry');
      const legs =
        primary(e).some((m) => LEG.includes(m)) ||
        LOCO.includes(e.pattern) ||
        e.pattern === 'cardio' ||
        single ||
        carry;
      return legs && !offLegs(e) && !joints(e).has('knee');
    }).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  it('every leg move done off the legs still carries a knee, ankle or hip tag', () => {
    const missing = RAW.filter(
      (e) =>
        primary(e).some((m) => LEG.includes(m)) &&
        !['knee', 'ankle', 'hip'].some((j) => joints(e).has(j)),
    ).map((e) => e.slug);
    expect(missing).toEqual([]);
  });

  const stopped = (area: string, slug: string) =>
    blockReason(bySlug.get(slug)!, { ...base, stoppedToday: [area] });

  it.each([
    'bird_dog',
    'standing_supported_bird_dog',
    'plank',
    'side_plank',
    'incline_plank',
    'rx_front_rack_hold',
  ])('a sharp lower-back stop rules out %s', (slug) => {
    expect(stopped('lower_back', slug)).toBe('contraindication');
  });

  it.each([
    'dumbbell_single_leg_rdl',
    'single_leg_balance',
    'supported_single_leg_calf_raise',
    'heel_walk',
    'dumbbell_farmer_walk',
    'bal_supported_heel_toe_walk',
    'fc_fast_march',
    'march_in_place',
    'fc_low_impact_jacks',
  ])('a sharp knee stop rules out %s', (slug) => {
    expect(stopped('knee', slug)).toBe('contraindication');
  });
});

describe('R4-03 custom exercises get the same checks', () => {
  const custom = (patch: Partial<CustomExerciseData>): CustomExerciseData => ({
    id: 'custom_1',
    name: 'My squat',
    primary: ['quads'],
    secondary: [],
    equipment: [],
    joints: [],
    createdAt: NOW.toISOString(),
    ...patch,
  });

  it('joints come from the main muscles even when none are ticked', () => {
    const e = customToExercise(custom({}));
    expect(e.joints.map((j) => j.joint)).toContain('knee');
    expect(e.contraindications).toContain('knee');
    expect(blockReason(e, { ...base, stoppedToday: ['knee'] })).toBe('contraindication');
    expect(blockReason(e, { ...base, restrictions: ['knee'] })).toBe('contraindication');
    expect(blockReason(e, { ...base, painToday: ['knee'] })).toBe('contraindication');
    const back = customToExercise(custom({ primary: ['lowerBack'] }));
    expect(blockReason(back, { ...base, stoppedToday: ['lower_back'] })).toBe('contraindication');
  });

  it('is standing only unless picked, and never "with support" with free weights', () => {
    expect(customToExercise(custom({})).positions).toEqual(['standing']);
    const squat = customToExercise(
      custom({ equipment: ['dumbbells'], positions: ['standing', 'with_support'] }),
    );
    expect(squat.positions).toEqual(['standing']);
    // Rosa (with support, fell last year): the two-hand dumbbell squat is out.
    expect(
      blockReason(squat, {
        ...base,
        mode: 'senior',
        position: 'with_support',
        conditions: ['fell_last_year'],
      }),
    ).toBe('position');
    const banded = customToExercise(
      custom({ equipment: ['resistance_bands'], positions: ['with_support'] }),
    );
    expect(banded.positions).toEqual(['with_support']);
  });
});

describe('R4-04 plans follow the age mode', () => {
  it('adult-only and 60+ plans are not for teens', () => {
    expect(planAllowed(planById('weightLoss-fullBody-3'), 'teen')).toBe(false);
    expect(planAllowed(planById('seniorSteady-fullBody-2'), 'teen')).toBe(false);
    expect(planAllowed(planById('weightLoss-fullBody-3'), 'adult')).toBe(true);
    for (const p of READY_PLANS) expect(planAllowed(p, 'child')).toBe(false);
  });

  it('an active plan for another mode is ignored by the generator input', () => {
    const program = { planId: 'weightLoss-fullBody-3', startedAt: '2026-09-01' };
    expect(programStatus(program, [], '2026-09-28', 'teen').plan).toBeUndefined();
    const teen = { ...base, mode: 'teen' as const, band: 'teen' as const };
    const input = withProgram(teen, LIBRARY, [], program, '2026-09-28');
    expect(input.muscleGoals).toEqual(teen.muscleGoals);
  });

  it('a teen opening the deep link gets "not available", no "Use this plan"', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 2011, onboardingComplete: true });
      useProgramStore.getState().reset();
    });
    mockId = 'weightLoss-fullBody-3';
    await render(<ProgramScreen />);
    expect(screen.getByText(/isn't available for your profile/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use this plan' })).toBeNull();
  });
});

describe('R4-05 profile-kind protection', () => {
  let access = '';
  function Probe() {
    access = useOwnerAccess();
    return null;
  }
  async function familyWithTeen() {
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    const owner = await act(() => ensureSelfProfile());
    await act(() => {
      useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Sam' });
    });
    await act(() => switchProfile('teen-1', { birthMonth: 3, birthYear: 2011 }));
    return owner;
  }

  it('the checks read the secure record', () => {
    const self = { id: 'a', kind: 'self' as const };
    expect(isOwnerProfile(null, { ownerId: 'a', activeId: 'a' })).toBe(false);
    expect(isOwnerProfile(null, { ownerId: null, activeId: null })).toBe(true);
    expect(isOwnerProfile(self, { ownerId: 'a', activeId: 'b' })).toBe(false);
    expect(isOwnerProfile(self, { ownerId: 'a', activeId: 'a' })).toBe(true);
    expect(minorLockFor({ id: 't', kind: 'self' }, { t: 'teen' })).toBe('teen');
  });

  it('a teen edited to "self" stays locked on the birth date', async () => {
    await familyWithTeen();
    expect(useOwnerIdentityStore.getState().minors['teen-1']).toBe('teen');
    await act(() =>
      useFamilyStore.setState((s) => ({
        profiles: s.profiles.map((p) => (p.id === 'teen-1' ? { ...p, kind: 'self' } : p)),
      })),
    );
    await render(<WhoScreen />);
    expect(screen.getByText(/Only a parent can change the birth date/)).toBeTruthy();
  });

  it('an active id set by hand to the owner, or an unknown one, meets the PIN', async () => {
    const owner = await familyWithTeen();
    await act(() => useFamilyStore.setState({ activeId: owner.id }));
    await render(<Probe />);
    expect(access).toBe('gate');
    await act(() => useFamilyStore.setState({ activeId: 'nobody' }));
    await render(<Probe />);
    expect(access).toBe('gate');
  });

  it('deleting the teen entry by hand does not open owner pages', async () => {
    await familyWithTeen();
    await act(() =>
      useFamilyStore.setState((s) => ({ profiles: s.profiles.filter((p) => p.id !== 'teen-1') })),
    );
    await render(<Probe />);
    expect(access).toBe('gate');
  });

  it('the owner switching back through the app is the owner', async () => {
    const owner = await familyWithTeen();
    await act(() => switchProfile(owner.id));
    await render(<Probe />);
    expect(access).toBe('owner');
  });
});
