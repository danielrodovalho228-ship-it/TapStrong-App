// Deterministic locale in tests.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

// Safe-area insets without a native provider.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
