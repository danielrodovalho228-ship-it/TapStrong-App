// Public config a store build must set (scripts/check-env.mjs); tests use test values.
process.env.EXPO_PUBLIC_SUPPORT_EMAIL ??= 'support@example.test';
process.env.EXPO_PUBLIC_TERMS_URL ??= 'https://example.test/terms';
process.env.EXPO_PUBLIC_PRIVACY_URL ??= 'https://example.test/privacy';

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
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
// Sharing (Phase 28): native modules stubbed; the tests check what is sent.
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    shareSingle: jest.fn(async () => ({ success: true })),
    open: jest.fn(async () => ({ success: true })),
    Social: { INSTAGRAM_STORIES: 'instagramstories', WHATSAPP: 'whatsapp' },
  },
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-clipboard', () => ({ setImageAsync: jest.fn(async () => true) }));
jest.mock('expo-screen-capture', () => {
  const listeners = new Set<() => void>();
  return {
    addScreenshotListener: jest.fn((fn: () => void) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    }),
    /** Test helper: "the person took a screenshot". */
    __takeScreenshot: () => listeners.forEach((fn) => fn()),
  };
});
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async (_ref: unknown, o?: { result?: string }) =>
    o?.result === 'base64' ? 'iVBORw0KGgo=' : '/tmp/card.png',
  ),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
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
