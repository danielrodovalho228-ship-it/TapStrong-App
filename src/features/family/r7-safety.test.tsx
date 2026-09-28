/**
 * QA round 7 — safety P1: a locked teen can't drop "Pregnant / postpartum"
 * by changing the body model (R7-02), nor switch to adult mode by editing
 * the stored birth year (R7-03).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SafetyScreen from '@/app/onboarding/safety';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { seedOwnerIdentity, useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';
import { ensureSelfProfile, switchProfile } from './switch';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ edit: '1' }),
  Redirect: () => null,
}));

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T10:00:00Z');
});

async function asTeen() {
  await act(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
  });
  await act(() => ensureSelfProfile());
  await act(() => {
    useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Ana' });
  });
  await act(() =>
    switchProfile('teen-1', {
      birthMonth: 3,
      birthYear: 2010,
      sex: 'f',
      conditions: ['pregnant_postpartum'],
      safetyDone: true,
    }),
  );
  await act(() =>
    useOnboardingStore.getState().update({ sex: 'f', conditions: ['pregnant_postpartum'] }),
  );
}

describe('R7-02 body model change', () => {
  it('a locked teen keeps "Pregnant / postpartum" when the body model changes', async () => {
    await asTeen();
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'm' }));
    expect(useOnboardingStore.getState().sex).toBe('m');
    expect(useOnboardingStore.getState().conditions).toContain('pregnant_postpartum');
    await act(() => useOnboardingStore.getState().update({ sex: 'm' }));
    expect(useOnboardingStore.getState().conditions).toContain('pregnant_postpartum');
    // Back to the girl model: the answer is still there.
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'f' }));
    expect(useOnboardingStore.getState().conditions).toContain('pregnant_postpartum');
  });

  it('the hidden answer never counts as removed in the safety check', async () => {
    await asTeen();
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'm' }));
    await render(<SafetyScreen />);
    // Adding an answer is free: no PIN, the hidden one stays.
    await fireEvent.press(screen.getByLabelText('Diabetes / prediabetes'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByText('For a parent or guardian')).toBeNull();
    expect(useOnboardingStore.getState().conditions).toEqual(
      expect.arrayContaining(['pregnant_postpartum', 'diabetes']),
    );
  });

  it('the owner (no lock) still drops it on a male body model', async () => {
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    await act(() => ensureSelfProfile());
    await act(() =>
      useOnboardingStore.getState().update({
        birthMonth: 3,
        birthYear: 1990,
        sex: 'f',
        conditions: ['pregnant_postpartum'],
      }),
    );
    await act(() => useOnboardingStore.getState().applyAnswer('body', { sex: 'm' }));
    expect(useOnboardingStore.getState().conditions).not.toContain('pregnant_postpartum');
  });
});

describe('R7-03 edited birth year', () => {
  it('a locked teen stays in teen mode with an adult birth year in storage', async () => {
    await asTeen();
    expect(useOwnerIdentityStore.getState().minors['teen-1']).toBe('teen');
    // What a tamper in plain storage would do.
    await act(() => useOnboardingStore.setState({ birthYear: 1990 }));
    expect(derive(useOnboardingStore.getState())).toMatchObject({ mode: 'teen', band: 'teen' });
  });

  it('removals still need the PIN after the edit', async () => {
    await asTeen();
    await act(() =>
      useOnboardingStore.setState({
        birthYear: 1990,
        painAreas: ['knee'],
        conditions: [],
      }),
    );
    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByLabelText('Knee'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    expect(useOnboardingStore.getState().painAreas).toEqual(['knee']);
  });

  it('the owner is never capped', async () => {
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    await act(() => ensureSelfProfile());
    await act(() => useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1990 }));
    expect(derive(useOnboardingStore.getState())?.mode).toBe('adult');
  });
});

describe('R7 P2: legacy records and the PIN', () => {
  it('a v1 record seeds minors from stored birth dates too, not only from `kind`', () => {
    useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: {} });
    const births: Record<string, { year: number; month: number }> = {
      owner: { year: 1985, month: 1 },
      sam: { year: 2011, month: 5 },
    };
    seedOwnerIdentity(
      [
        { id: 'owner', kind: 'self' },
        // A teen whose kind was edited to "parent" before the upgrade.
        { id: 'sam', kind: 'parent' },
      ],
      (id) => births[id] ?? null,
    );
    expect(useOwnerIdentityStore.getState().minors).toEqual({ sam: 'teen' });
    expect(useOwnerIdentityStore.getState().activeId).toBeNull();
  });

  it('no PIN yet on an unproven profile: the owner can create one with the account email', async () => {
    const { ParentGate } = jest.requireActual('./ParentGate') as typeof import('./ParentGate');
    const account = jest.requireActual(
      '@/features/account/store',
    ) as typeof import('@/features/account/store');
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'sam', kind: 'child', createdAt: '' },
        ],
        activeId: 'owner',
      });
      useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: { sam: 'teen' } });
      account.useAccountStore.getState().update({ saved: true, email: 'owner@example.test' });
    });
    await render(<ParentGate onPass={() => undefined} onCancel={() => undefined} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Set a PIN with the account email' }));
    expect(screen.getByRole('button', { name: /code/i })).toBeTruthy();
  });

  it('a directly opened safety edit falls back to Restrictions', async () => {
    const { router } = jest.requireMock('expo-router') as {
      router: { canGoBack: () => boolean; replace: jest.Mock };
    };
    const canGoBack = router.canGoBack;
    router.canGoBack = () => false;
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    await act(() => ensureSelfProfile());
    await act(() =>
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 1990, safetyDone: true, painAreas: ['knee'] }),
    );
    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.replace).toHaveBeenCalledWith('/restrictions');
    router.canGoBack = canGoBack;
  });
});
