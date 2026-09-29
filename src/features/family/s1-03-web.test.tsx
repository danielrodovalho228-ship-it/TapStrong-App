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
import WhoScreen from '@/app/onboarding/who';
import PlansScreen from '@/app/plans';
import { useOnboardingStore } from '@/features/onboarding/store';
import { familyAvailable, setFamilyOnWeb } from '@/lib/features';
import { storeLinks } from '@/lib/storeLinks';

import { WebMobileOnly } from './components/WebMobileOnly';

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

let mockStores: { ios: string | null; android: string | null } | null = null;
jest.mock('@/lib/storeLinks', () => {
  const real = jest.requireActual('@/lib/storeLinks');
  return {
    ...real,
    storeLinks: (env?: Record<string, string>) =>
      env ? real.storeLinks(env) : (mockStores ?? real.storeLinks()),
  };
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

describe('round 2 P3: web copy for adults without family', () => {
  it('/plans says "Choose your plan", not "Train the whole family"', async () => {
    await adult();
    await render(<PlansScreen />);
    expect(screen.getByText('Choose your plan')).toBeTruthy();
    expect(screen.queryByText('Train the whole family')).toBeNull();
  });

  it('/onboarding/who offers no "My teen" dead end on the web', async () => {
    await adult();
    await render(<WhoScreen />);
    expect(screen.getByRole('radio', { name: 'Me' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /My teen|My child/ })).toBeNull();
  });

  it('…and still offers it on the phone', async () => {
    os.restore();
    os = jest.replaceProperty(Platform, 'OS', 'ios');
    await adult();
    await render(<WhoScreen />);
    expect(screen.getByRole('radio', { name: /My teen|My child/ })).toBeTruthy();
  });

  it('the teen note links to the stores once their pages are set, only real store hosts', async () => {
    mockStores = storeLinks({
      EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/tapstrong/id1',
      EXPO_PUBLIC_PLAY_STORE_URL: 'https://evil.example/tapstrong',
    });
    try {
      await render(<WebMobileOnly kind="teen" />);
      expect(screen.getByLabelText('Get it on the App Store')).toBeTruthy();
      expect(screen.queryByLabelText('Get it on Google Play')).toBeNull();
    } finally {
      mockStores = null;
    }
    expect(storeLinks({})).toEqual({ ios: null, android: null });
    expect(
      storeLinks({ EXPO_PUBLIC_PLAY_STORE_URL: 'http://play.google.com/x' }).android,
    ).toBeNull();
  });
});
