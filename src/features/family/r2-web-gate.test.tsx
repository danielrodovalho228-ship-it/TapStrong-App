/**
 * Security round 2, S2-P2-1: on the web a teen or a family profile is blocked
 * on every address, not just the tabs. Every route of the app is checked;
 * only fixing the birth date, the account and deleting it stay open.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Platform, Text } from 'react-native';

import { useOnboardingStore } from '@/features/onboarding/store';

import { WEB_BLOCKED_ALLOWED, WebFamilyGate } from './components/WebMobileOnly';
import { useOwnerIdentityStore } from './ownerIdentity';
import { useFamilyStore } from './store';

let mockPath = '/home';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => mockPath,
}));

/** Every screen file under src/app as the address the browser shows. */
function webRoutes(): string[] {
  const root = join(__dirname, '..', '..', 'app');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (
        /\.tsx$/.test(name) &&
        !/^(_layout|\+html|\+not-found)\.tsx$/.test(name) &&
        !name.includes('.test.')
      )
        out.push(
          ('/' + relative(root, path))
            .replace(/\.tsx$/, '')
            .replace(/\/\([^)]+\)/g, '')
            .replace(/\[(\w+)\]/g, 'x1')
            .replace(/\/index$/, '') || '/',
        );
    }
  };
  walk(root);
  return out.map((r) => r || '/');
}

let os: jest.ReplaceProperty<typeof Platform.OS>;
beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
  mockPush.mockClear();
});
afterEach(() => os.restore());

async function teen() {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: new Date().getFullYear() - 15,
      onboardingComplete: true,
    });
    useFamilyStore.setState({
      profiles: [{ id: 'me', kind: 'self', createdAt: '' }],
      activeId: 'me',
    });
    useOwnerIdentityStore.setState({ ownerId: 'me', activeId: 'me', minors: {} });
  });
}

const app = () => (
  <WebFamilyGate>
    <Text>app screen</Text>
  </WebFamilyGate>
);

it('knows the whole route list (sanity)', () => {
  const routes = webRoutes();
  for (const r of ['/home', '/settings', '/workout/new', '/restrictions', '/programs', '/account'])
    expect(routes).toContain(r);
  expect(routes.length).toBeGreaterThan(40);
});

it('a teen on the web: every address but the allowed ones shows only the note', async () => {
  await teen();
  const open: string[] = [];
  for (const path of webRoutes()) {
    mockPath = path;
    await render(app());
    if (!screen.queryByTestId('web-family-gate')) open.push(path);
  }
  expect(open.sort()).toEqual([...WEB_BLOCKED_ALLOWED].sort());
});

it('a family profile left open on the web is blocked too', async () => {
  await teen();
  await act(() => {
    useOnboardingStore.getState().update({ birthYear: 1985 });
    useFamilyStore.setState({
      profiles: [
        { id: 'me', kind: 'self', createdAt: '' },
        { id: 'mom', kind: 'parent', createdAt: '' },
      ],
      activeId: 'mom',
    });
  });
  mockPath = '/settings';
  await render(app());
  expect(screen.getByText('Family profiles are available in the mobile app.')).toBeTruthy();
});

it('the teen note has its own title and a way to fix the birth date', async () => {
  await teen();
  mockPath = '/workout/new';
  await render(app());
  expect(
    screen.getByRole('header', { name: 'TapStrong for teens is in the mobile app' }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Change my birth date' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/onboarding/who', params: { edit: '1' } });
});

it('an adult on the web, and anyone on the phone, is never blocked', async () => {
  await teen();
  await act(() => useOnboardingStore.getState().update({ birthYear: 1985 }));
  mockPath = '/settings';
  await render(app());
  expect(screen.queryByTestId('web-family-gate')).toBeNull();
  await teen();
  os.restore();
  await render(app());
  expect(screen.queryByTestId('web-family-gate')).toBeNull();
  os = jest.replaceProperty(Platform, 'OS', 'web');
});
