/**
 * The internal test build (Daniel, Oct 3; EAS profile "internal", never the
 * public stores): the launch set as drafts, the uploaded clips from the
 * bucket, and a small "Test build" badge in Settings. Production builds have
 * none of it (bundle:check proves it on real bundles).
 */
import '@/i18n';

import { act, render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { useOnboardingStore } from '@/features/onboarding/store';

import launch from '../../../supabase/seed/launch_set.json';
import uploaded from '../../../assets/media/uploaded.json';
import { devLibrary } from '../exercises/library';
import { demoVideo } from '../exercises/videos';
import { afterOnboarding } from '../onboarding/finish';
import { buildProgramSession, SHOULDER_PROGRAM } from '../rehab/programs';

jest.setTimeout(30_000);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('@/lib/env', () => ({
  publicEnv: { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'anon' },
}));

const g = globalThis as unknown as { __DEV__: boolean };
const dev = g.__DEV__;
afterEach(() => {
  g.__DEV__ = dev;
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
});

/** A release build (no __DEV__), as production or internal. */
function release(variant?: 'internal') {
  g.__DEV__ = false;
  if (variant) process.env.EXPO_PUBLIC_APP_VARIANT = variant;
}

it('production: no drafts at all', () => {
  release();
  expect(devLibrary()).toEqual([]);
});

it('internal: exactly the launch set, as drafts', () => {
  release('internal');
  const lib = devLibrary();
  expect(lib.map((e) => e.slug).sort()).toEqual(launch.exercises.map((x) => x.slug).sort());
  expect(lib.every((e) => e.status === 'draft')).toBe(true);
});

it('internal: uploaded clips stream from the bucket, of the profile’s sex', () => {
  const slug = uploaded.slugs[0];
  release();
  expect(demoVideo(slug, 'f')).toBeNull();
  release('internal');
  expect(demoVideo(slug, 'm')).toEqual({
    uri: `https://demo.supabase.co/storage/v1/object/public/exercise-media/${slug}.m.mp4`,
    useCaching: true,
  });
});

it('a small "Test build" badge in Settings, only in the internal build', async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1990,
      sex: 'f',
      onboardingComplete: true,
    });
  });
  await render(<SettingsScreen />);
  expect(screen.queryByTestId('test-build-badge')).toBeNull();
  screen.unmount();
  process.env.EXPO_PUBLIC_APP_VARIANT = 'internal';
  await render(<SettingsScreen />);
  expect(screen.getByText('Test build')).toBeTruthy();
});

it('internal: all 18 shoulder exercises are in, so the program starts (no video needed)', () => {
  release('internal');
  const library = devLibrary();
  for (const key of ['A', 'B', 'C'] as const) {
    const s = buildProgramSession(SHOULDER_PROGRAM, key, { library, affected: 'left', week: 1 });
    expect(s.missing).toEqual([]);
    expect(s.items.length).toBeGreaterThan(0);
  }
});

it('"I have a frozen or painful shoulder" opens the shoulder program after onboarding, once', async () => {
  await act(() => useOnboardingStore.getState().update({ careShoulder: true }));
  expect(afterOnboarding('/home')).toEqual({
    pathname: '/rehab/[id]',
    params: { id: 'shoulder_mobility_strength' },
  });
  expect(afterOnboarding('/home')).toBe('/home');
});
