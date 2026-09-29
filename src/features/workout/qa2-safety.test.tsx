/**
 * QA round 2 — P0 safety fixes (docs/qa-round-2.md §1). One test per finding.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import FamilyScreen from '@/app/(tabs)/family';
import WhoScreen from '@/app/onboarding/who';
import { useBillingStore } from '@/features/billing/store';
import { devLibrary } from '@/features/exercises/library';
import { setParentPin, useParentPinStore } from '@/features/family/parentPin';
import { useFamilyStore } from '@/features/family/store';
import { removeMember } from '@/features/family/switch';
import { generateSession } from '@/features/generator';
import { blockReason } from '@/features/generator/filters';
import { inputFromProfile } from '@/features/generator/fromProfile';
import type { GeneratorInput } from '@/features/generator/types';
import { JOINT_AREA } from '@/features/movement/catalog';
import { childLockFor, evaluateAgeGate } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';

import { useWorkoutStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null, ensureSession: async () => true }));

const LIBRARY = devLibrary();
const ex = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;
const NOW = new Date('2026-09-27T12:00:00Z');
const today = { year: 2026, month: 9 };

beforeAll(() => {
  clock.now = () => NOW;
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'm',
      mainGoals: ['strength'],
      minutes: 40,
      muscleGoals: [
        { muscleKey: 'quads', goal: 'strengthen' },
        { muscleKey: 'hamstrings', goal: 'strengthen' },
        { muscleKey: 'glutes', goal: 'strengthen' },
      ],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useFamilyStore.getState().reset();
    useBillingStore.getState().reset();
    useParentPinStore.getState().reset();
    setParentPin('2468');
  });
  mockParams = {};
});

describe('R2-01 teens can be added; members can be removed', () => {
  it('a teen profile works within 13–17; an under-13 profile stays under 13', () => {
    const teen = childLockFor({ kind: 'child' });
    const child = childLockFor({ kind: 'child', consentAt: 'x' });
    expect(teen).toBe('teen');
    expect(child).toBe('under13');
    expect(childLockFor({ kind: 'self' })).toBeUndefined();
    expect(evaluateAgeGate('child', { year: 2012, month: 5 }, today, false, teen)).toMatchObject({
      status: 'ok',
      mode: 'teen',
    });
    // A teen profile can't be moved under 13 (that would skip consent)…
    expect(evaluateAgeGate('child', { year: 2016, month: 5 }, today, false, teen).status).toBe(
      'teen_locked',
    );
    // …or to 18+ (QA R8 P2: it says the teen lock, not "too old for a child").
    expect(evaluateAgeGate('child', { year: 2006, month: 5 }, today, false, teen).status).toBe(
      'teen_locked',
    );
    expect(evaluateAgeGate('child', { year: 2012, month: 5 }, today, true, child).status).toBe(
      'child_locked',
    );
  });

  it('a new teen profile can finish the age step', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
        ],
        activeId: 't1',
      });
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().update({ who: 'child', birthMonth: 5, birthYear: 2012 });
    });
    await render(<WhoScreen />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.queryByText(/stays in kids mode/)).toBeNull();
  });

  it('removing a member frees the slot and deletes their data; never the owner', () => {
    useFamilyStore.setState({
      profiles: [
        { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
        { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
      ],
      activeId: 'me',
    });
    kvStorage.setItem('profile-snapshot:t1', '{}');
    expect(removeMember('me')).toBe(false);
    expect(removeMember('t1')).toBe(true);
    expect(useFamilyStore.getState().profiles.map((p) => p.id)).toEqual(['me']);
    expect(kvStorage.getItem('profile-snapshot:t1')).toBeNull();
  });

  it('Remove member needs the parent gate and a confirmation', async () => {
    await act(() =>
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          { id: 't1', kind: 'child', name: 'Leo', createdAt: '2026-09-02T00:00:00Z' },
        ],
        activeId: 'me',
      }),
    );
    await render(<FamilyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Leo' }));
    expect(useFamilyStore.getState().profiles).toHaveLength(2);
    await fireEvent.changeText(screen.getByLabelText('Parent PIN'), '2468');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(useFamilyStore.getState().profiles).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, remove Leo' }));
    expect(useFamilyStore.getState().profiles.map((p) => p.id)).toEqual(['me']);
  });
});

describe('R2-02 after a sharp-pain stop, nothing moves that joint the same day', () => {
  const input = (patch: Partial<GeneratorInput>): GeneratorInput => ({
    ...inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!,
    ...patch,
  });

  it('knee: no leg extension or any other knee movement', () => {
    const knee = input({ stoppedToday: ['knee'] });
    expect(ex('machine_leg_extension').contraindications).not.toContain('knee');
    expect(blockReason(ex('machine_leg_extension'), knee)).toBe('contraindication');
    for (const item of generateSession(knee).items) {
      const e = LIBRARY.find((x) => x.id === item.exerciseId)!;
      expect(e.joints.some((j) => JOINT_AREA[j.joint] === 'knee')).toBe(false);
    }
  });

  it('lower back: no hip thrust', () => {
    const back = input({ stoppedToday: ['lower_back'] });
    expect(blockReason(ex('barbell_hip_thrust'), back)).toBe('contraindication');
    for (const item of generateSession(back).items) {
      const e = LIBRARY.find((x) => x.id === item.exerciseId)!;
      expect(e.joints.some((j) => j.joint === 'lower_back')).toBe(false);
    }
  });

  it('dull pain today: no moves through the joint, pain-free holds allowed', () => {
    const dull = input({ painToday: ['knee'] });
    expect(blockReason(ex('machine_leg_extension'), dull)).toBe('contraindication');
    for (const item of generateSession(dull).items) {
      const e = LIBRARY.find((x) => x.id === item.exerciseId)!;
      expect(e.joints.some((j) => j.joint === 'knee' && j.range !== 'isometric')).toBe(false);
    }
  });
});
