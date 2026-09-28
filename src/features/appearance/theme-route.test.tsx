/**
 * QA R6-01: a theme change (the phone flipping to dark at sunset) keeps the
 * route, its params and the nested navigators; nothing jumps to Home.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useState } from 'react';
import { Pressable, Text, useColorScheme } from 'react-native';

import { PALETTES, useColors } from '@/theme';

import { useAppearanceStore } from './store';
import { ThemeGate } from './ThemeGate';

jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const phone = useColorScheme as jest.Mock;

function Player() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [reps, setReps] = useState(8);
  return (
    <Pressable accessibilityRole="button" onPress={() => setReps((r) => r + 1)}>
      <Text>{`workout ${id} reps ${reps} bg ${c.background}`}</Text>
    </Pressable>
  );
}

it('keeps route, params and player state across a theme change', async () => {
  phone.mockReturnValue('light');
  useAppearanceStore.setState({ appearance: 'auto' });
  const router = renderRouter(
    {
      _layout: () => (
        <ThemeGate>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeGate>
      ),
      index: () => <Text>home</Text>,
      'workout/[id]/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      'workout/[id]/play': Player,
    },
    { initialUrl: '/workout/w1/play' },
  );
  await router;
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getByText(`workout w1 reps 9 bg ${PALETTES.light.background}`)).toBeTruthy();

  // The root re-renders with the new scheme, as when the phone flips (the
  // mocked hook cannot emit that event, so the setting stands in for it).
  phone.mockReturnValue('dark');
  await act(async () => useAppearanceStore.getState().setAppearance('dark'));

  expect(router.getPathname()).toBe('/workout/w1/play');
  expect(screen.getByText(`workout w1 reps 9 bg ${PALETTES.dark.background}`)).toBeTruthy();
  expect(screen.queryByText('home')).toBeNull();
});
