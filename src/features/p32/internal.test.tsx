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
