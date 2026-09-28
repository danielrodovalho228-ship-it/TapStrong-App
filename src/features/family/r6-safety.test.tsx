/**
 * QA round 6 — safety P1: a teen's safety answers and recovery plans stay
 * behind the parent PIN from every route (R6-04), and an upgraded phone's
 * v1 owner record never trusts an unproven active profile (R6-05).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MovementPainScreen from '@/app/movement-pain/index';
import SafetyScreen from '@/app/onboarding/safety';
import RestrictionsScreen from '@/app/restrictions';
import { useMovementPainStore, type MovementPain } from '@/features/movement/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';

import { isOwnerProfile, seedOwnerIdentity, useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';
import { ensureSelfProfile, switchProfile } from './switch';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

beforeAll(() => {
  clock.now = () => new Date('2026-09-28T10:00:00Z');
});

async function asTeen(patch: Parameters<typeof switchProfile>[1] = {}) {
  await act(() => {
    useFamilyStore.getState().reset();
    useOnboardingStore.getState().reset();
    useMovementPainStore.getState().reset();
  });
  await act(() => ensureSelfProfile());
  await act(() => {
    useFamilyStore.getState().add({ id: 'teen-1', kind: 'child', name: 'Sam' });
  });
  await act(() =>
    switchProfile('teen-1', { birthMonth: 3, birthYear: 2011, safetyDone: true, ...patch }),
  );
}

beforeEach(() => {
  mockParams = {};
  Object.values(router).forEach((m) => m.mockClear?.());
});

describe('R6-04 teen safety answers from every route', () => {
  it('Restrictions → "Change in safety check" opens the staged editor', async () => {
    await asTeen({ painAreas: ['knee'] });
    await act(() => useOnboardingStore.getState().update({ painAreas: ['knee'] }));
    await render(<RestrictionsScreen />);
    await fireEvent.press(screen.getAllByText('Change in safety check')[0]);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/onboarding/safety',
      params: { edit: '1' },
    });
  });

  it('a deep link without edit still stages removals behind the PIN', async () => {
    await asTeen({ painAreas: ['knee'] });
    await act(() =>
      useOnboardingStore.getState().update({ painAreas: ['knee'], safetyDone: true }),
    );
    mockParams = {};
    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByLabelText('Knee'));
    // Nothing is written while choosing.
    expect(useOnboardingStore.getState().painAreas).toEqual(['knee']);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    expect(useOnboardingStore.getState().painAreas).toEqual(['knee']);
  });

  it('a new report replacing the active plan for that area needs the PIN', async () => {
    await asTeen();
    const active: MovementPain = {
      id: 'old',
      area: 'shoulder',
      joints: ['shoulder'],
      side: 'right',
      painful: ['shoulder.abduction'],
      painFree: [],
      score: 4,
      duration: '2_6_weeks',
      active: true,
      createdAt: '2026-09-01T09:00:00.000Z',
      checks: [],
      retests: [],
    };
    await act(() => useMovementPainStore.getState().add(active));
    mockParams = { area: 'shoulder' };
    await render(<MovementPainScreen />);
    const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Right' }));
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'None of these' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Raise arm in front: Hurts' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pain 2 out of 10' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: '2 to 6 weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Build my recovery plan' }));
    expect(screen.getByText('For a parent or guardian')).toBeTruthy();
    const reports = useMovementPainStore.getState().reports;
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ id: 'old', active: true });
  });
});

describe('R6-05 owner record from an older version', () => {
  beforeEach(() => useOwnerIdentityStore.setState({ ownerId: null, activeId: null, minors: {} }));

  it('a null active id is unproven once an owner exists', () => {
    const self = { id: 'owner', kind: 'self' as const };
    expect(isOwnerProfile(self, { ownerId: 'owner', activeId: null })).toBe(false);
    expect(isOwnerProfile(self, { ownerId: 'owner', activeId: 'owner' })).toBe(true);
    expect(isOwnerProfile(self, { ownerId: null, activeId: null })).toBe(true);
  });

  it('seeds minors from the family list and never trusts its active id', () => {
    // A v1 record: owner id only. The plain family list says the owner is active.
    useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: {} });
    seedOwnerIdentity([
      { id: 'owner', kind: 'self' },
      { id: 'teen-1', kind: 'child' },
    ]);
    const s = useOwnerIdentityStore.getState();
    expect(s.minors).toEqual({ 'teen-1': 'teen' });
    expect(s.activeId).toBeNull();
  });

  it('with no minors on the phone the owner is active', () => {
    useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: {} });
    seedOwnerIdentity([{ id: 'owner', kind: 'self' }]);
    expect(useOwnerIdentityStore.getState().activeId).toBe('owner');
  });

  it('the family store seeds a v1 record once both have loaded', async () => {
    useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: null, minors: {} });
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'owner', kind: 'self', createdAt: '' },
          { id: 'teen-1', kind: 'child', createdAt: '' },
        ],
        activeId: 'owner',
      });
    });
    await useOwnerIdentityStore.persist.rehydrate();
    expect(useOwnerIdentityStore.getState().minors['teen-1']).toBe('teen');
    expect(useOwnerIdentityStore.getState().activeId).toBeNull();
  });
});
