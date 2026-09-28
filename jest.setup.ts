// Native gesture module mocks.
import 'react-native-gesture-handler/jestSetup';

// Deterministic locale in tests.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

// Safe-area insets without a native provider.
jest.mock(
  'react-native-safe-area-context',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Gestures only matter on a device; in tests the detector renders its child.
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: { children: unknown }) => children,
}));

// Native animation and speech modules.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const shared = <T>(value: T) => {
    const box = { value, get: () => box.value, set: (v: T) => void (box.value = v) };
    return box;
  };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: <C>(c: C) => c },
    createAnimatedComponent: <C>(c: C) => c,
    useSharedValue: shared,
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: <T>(v: T) => v,
  };
});
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(async () => undefined) })),
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
}));

// Kids under 13 are off for launch (Phase 12), but their code stays and is
// tested: suites run with the switch on unless they turn it off themselves
// (see qa3-kids-off.test.tsx for the launch behaviour).
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./src/lib/features').setKidsUnder13Enabled(true);

// Keychain / Keystore: an in-memory stand-in (the parent PIN store).
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
    deleteItemAsync: async (key: string) => void items.delete(key),
  };
});
