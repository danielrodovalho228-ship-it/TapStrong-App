/**
 * Security round 1, S1-03(b): until the server-checked PIN has passed QA on
 * the web, the web is for adults without family: no Family tab, /family/*
 * goes Home, no Family plan, a teen profile sees a note.
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import FamilyScreen from '@/app/(tabs)/family';
import AddMemberScreen from '@/app/family/add';
import PlansScreen from '@/app/plans';
import { useOnboardingStore } from '@/features/onboarding/store';
import { familyAvailable, setFamilyOnWeb } from '@/lib/features';

import { useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('expo-router/js-tabs', () => {
  const { Text, View } = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Tabs.Screen = function Screen({ name, options }: { name: string; options: { href?: null } }) {
    return options.href === null ? null : <Text>{`tab:${name}`}</Text>;
  };
  return { Tabs };
});

let os: jest.ReplaceProperty<typeof Platform.OS>;

async function adult(year = 1985) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore
      .getState()
      .update({ birthMonth: 3, birthYear: year, onboardingComplete: true });
    useFamilyStore.setState({
      profiles: [{ id: 'owner', kind: 'self', createdAt: '' }],
      activeId: 'owner',
    });
    useOwnerIdentityStore.setState({ ownerId: 'owner', activeId: 'owner', minors: {} });
  });
}

beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(() => {
  os.restore();
  setFamilyOnWeb(false);
});

it('mobile keeps family; the web has none until it is switched on', () => {
  expect(familyAvailable()).toBe(false);
  os.restore();
  expect(familyAvailable()).toBe(true);
  os = jest.replaceProperty(Platform, 'OS', 'web');
  setFamilyOnWeb(true);
  expect(familyAvailable()).toBe(true);
});

it('no Family tab on the web', async () => {
  await adult();
  await render(<TabsLayout />);
  expect(screen.getByText('tab:home')).toBeTruthy();
  expect(screen.queryByText('tab:family')).toBeNull();
});

it('the Family tab and /family/add go Home on the web', async () => {
  await adult();
  await render(<FamilyScreen />);
  expect(screen.getByText('redirect:/home')).toBeTruthy();
  await render(<AddMemberScreen />);
  expect(screen.getByText('redirect:/home')).toBeTruthy();
});

it('Plans on the web: the note, no Family plan', async () => {
  await adult();
  await render(<PlansScreen />);
  expect(screen.getByText('Family profiles are available in the mobile app.')).toBeTruthy();
  expect(screen.queryByRole('radio', { name: /Family/ })).toBeNull();
});
