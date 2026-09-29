/**
 * QA R9 P2: on the owner's phone with the teen active, the Family link says
 * "An adult needs…" before any parent PIN (no real OwnerOnly mock here).
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import PlansScreen from '@/app/plans';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { useParentPinStore, setParentPin } from '@/features/family/parentPin';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

it('the Family link from the teen profile: no PIN, just the adult notice', async () => {
  await act(() => {
    useParentPinStore.getState().reset();
    setParentPin('2468');
    useFamilyStore.setState({
      profiles: [
        { id: 'owner', kind: 'self', createdAt: '' },
        { id: 'teen', kind: 'child', createdAt: '' },
      ],
      activeId: 'teen',
    });
    useOwnerIdentityStore.setState({
      ownerId: 'owner',
      activeId: 'teen',
      minors: { teen: 'teen' },
    });
    useOnboardingStore.getState().reset();
    useOnboardingStore
      .getState()
      .update({ birthMonth: 3, birthYear: 2011, onboardingComplete: true });
  });
  mockParams = { plan: 'family' };
  await render(<PlansScreen />);
  expect(screen.getByText('An adult needs to subscribe to the Family plan.')).toBeTruthy();
  expect(screen.queryByText('Enter the parent PIN.')).toBeNull();
  // Without the link, Plans still asks the parent PIN first.
  mockParams = {};
  await render(<PlansScreen />);
  expect(screen.getByText('Enter the parent PIN.')).toBeTruthy();
});
