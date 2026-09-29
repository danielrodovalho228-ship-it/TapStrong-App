/**
 * QA round 8 — safety P1: a profile switch keeps a locked teen's hidden
 * answers (R8-01); a too-young, deleted or invalid birth date can't lift the
 * teen lock (R8-02); a v1-upgraded phone not yet proven by the PIN still
 * applies the lock (R8-03).
 */
import '@/i18n';

import { act } from '@testing-library/react-native';

import { derive, FALLBACK_MODE, modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { activeMinorLock, useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';
import { ensureSelfProfile, switchProfile } from './switch';

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T10:00:00Z');
});

async function setup() {
  await act(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
  });
  await act(() => ensureSelfProfile());
  await act(() =>
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1985, sex: 'f' }),
  );
}

describe('R8-01 switching away and back', () => {
  it('a locked teen keeps pregnancy + osteoporosis on a boy body model', async () => {
    await setup();
    await act(() => {
      useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Ana' });
    });
    await act(() =>
      switchProfile('teen-1', { birthMonth: 3, birthYear: 2010, sex: 'f', safetyDone: true }),
    );
    await act(() =>
      useOnboardingStore
        .getState()
        .update({ conditions: ['osteoporosis', 'pregnant_postpartum'], position: 'seated_only' }),
    );
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'm' }));
    expect(useOnboardingStore.getState().conditions).toContain('pregnant_postpartum');

    const self = useFamilyStore.getState().profiles.find((p) => p.kind === 'self')!;
    await act(() => switchProfile(self.id));
    expect(useOnboardingStore.getState().birthYear).toBe(1985);
    await act(() => switchProfile('teen-1'));

    const s = useOnboardingStore.getState();
    expect(s.conditions).toEqual(['osteoporosis', 'pregnant_postpartum']);
    expect(s.position).toBe('seated_only');
    expect(s.sex).toBe('m');
  });

  it.each(['self', 'parent', 'child'] as const)(
    'every safety answer survives for a %s profile',
    async (kind) => {
      await setup();
      const self = useFamilyStore.getState().profiles.find((p) => p.kind === 'self')!;
      await act(() =>
        useOnboardingStore.getState().update({
          painAreas: ['knee', 'lower_back'],
          conditions: ['diabetes', 'pregnant_postpartum'],
          position: 'with_support',
          redFlagAcknowledged: true,
        }),
      );
      const saved = (({ painAreas, conditions, position, redFlagAcknowledged }) => ({
        painAreas,
        conditions,
        position,
        redFlagAcknowledged,
      }))(useOnboardingStore.getState());
      if (kind !== 'self') {
        await act(() => {
          useFamilyStore.getState().add({ id: 'other', kind });
        });
        await act(() => switchProfile('other', { birthMonth: 1, birthYear: 2011 }));
        await act(() => switchProfile(self.id));
      } else {
        await act(() => {
          useFamilyStore.getState().add({ id: 'other', kind: 'parent' });
        });
        await act(() => switchProfile('other', { birthMonth: 1, birthYear: 1950 }));
        await act(() => switchProfile(self.id));
      }
      const s = useOnboardingStore.getState();
      expect({
        painAreas: s.painAreas,
        conditions: s.conditions,
        position: s.position,
        redFlagAcknowledged: s.redFlagAcknowledged,
      }).toEqual(saved);
    },
  );
});

describe('R8-02 tampered birth date on a locked teen', () => {
  const lockTeen = () =>
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'teen',
      minors: { teen: 'teen' },
    });
  afterEach(() => useOwnerIdentityStore.setState({ ownerId: null, activeId: null, minors: {} }));

  it.each([
    ['2016', { birthMonth: 3, birthYear: 2016 }],
    ['2021', { birthMonth: 3, birthYear: 2021 }],
    ['null', { birthMonth: undefined, birthYear: undefined }],
    ['NaN', { birthMonth: 3, birthYear: Number.NaN }],
    ['month 13', { birthMonth: 13, birthYear: 2010 }],
    ['1990', { birthMonth: 3, birthYear: 1990 }],
  ])('%s stays in teen mode', (_label, birth) => {
    lockTeen();
    const d = derive(birth);
    expect(d).toMatchObject({ mode: 'teen', band: 'teen' });
    expect(d!.age).toBeGreaterThanOrEqual(13);
    expect(d!.age).toBeLessThanOrEqual(17);
    expect(modeOf(birth)).toBe('teen');
  });

  it('a real teen age is kept', () => {
    lockTeen();
    expect(derive({ birthMonth: 3, birthYear: 2011 })?.age).toBe(15);
  });

  it('an under-13 lock never leaves child mode', () => {
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'kid',
      minors: { kid: 'under13' },
    });
    for (const birthYear of [1990, 2010, 2024, undefined])
      expect(derive({ birthMonth: 3, birthYear })?.mode).toBe('child');
  });

  it('with no lock and no valid date the fallback is restrictive, never adult', () => {
    expect(derive({ birthMonth: undefined, birthYear: undefined })).toBeNull();
    expect(FALLBACK_MODE).not.toBe('adult');
    expect(modeOf({})).toBe(FALLBACK_MODE);
    // The owner with a real date is untouched.
    expect(modeOf({ birthMonth: 3, birthYear: 1990 })).toBe('adult');
  });
});

describe('R8-03 v1-upgraded phone, not yet proven', () => {
  it('the lock is found by the plain active id until the PIN is entered', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'sam', kind: 'child', createdAt: '' },
        ],
        activeId: 'sam',
      });
      // What seeding leaves on a v1 phone with a minor: no secure active id.
      useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: { sam: 'teen' } });
    });
    expect(activeMinorLock()).toBe('teen');
    expect(derive({ birthMonth: 3, birthYear: 1990 })).toMatchObject({ mode: 'teen', age: 17 });
  });

  it('a proven owner is not locked by a minor elsewhere on the phone', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'sam', kind: 'child', createdAt: '' },
        ],
        activeId: 'owner',
      });
      useOwnerIdentityStore.setState({
        ownerId: 'owner',
        activeId: 'owner',
        minors: { sam: 'teen' },
      });
    });
    expect(activeMinorLock()).toBeUndefined();
    expect(modeOf({ birthMonth: 3, birthYear: 1990 })).toBe('adult');
  });
});
