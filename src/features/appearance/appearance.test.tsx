/**
 * Theme v2 — Settings → Appearance and the live switch: Automatic follows
 * the phone, Light / Dark are fixed, and the change is instant.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';

import AppearanceScreen from '@/app/settings/appearance';
import { AppText } from '@/components/ui';
import { applyScheme, colors, makeStyles, PALETTES, useColors } from '@/theme';

import { useAppearanceStore } from './store';
import { ThemeGate } from './ThemeGate';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const phone = useColorScheme as jest.Mock;

const useStyles = makeStyles(() => ({ probe: { backgroundColor: colors.surface } }));
let mounts = 0;
/** Stands in for a running workout: local state and a mount counter. */
function Probe() {
  const c = useColors();
  const styles = useStyles();
  const [reps, setReps] = useState(0);
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <View testID="probe" style={styles.probe}>
      <AppText>{c.background}</AppText>
      <Pressable accessibilityRole="button" onPress={() => setReps((r) => r + 1)}>
        <AppText>{`reps ${reps}`}</AppText>
      </Pressable>
    </View>
  );
}

function App() {
  return (
    <ThemeGate>
      <Probe />
    </ThemeGate>
  );
}

beforeEach(() => {
  phone.mockReturnValue('light');
  useAppearanceStore.setState({ appearance: 'auto' });
});
afterAll(() => applyScheme('light'));

describe('Appearance setting', () => {
  it('offers Automatic, Light and Dark; Automatic by default', async () => {
    await render(<AppearanceScreen />);
    expect(screen.getByRole('radio', { name: /Automatic/ }).props.accessibilityState.checked).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: /Dark/ }));
    expect(useAppearanceStore.getState().appearance).toBe('dark');
    expect(screen.getByRole('radio', { name: /Dark/ }).props.accessibilityState.checked).toBe(true);
  });
});

describe('ThemeGate', () => {
  it('Automatic follows the phone', async () => {
    phone.mockReturnValue('dark');
    await render(<App />);
    expect(screen.getByText(PALETTES.dark.background)).toBeTruthy();
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(PALETTES.dark.background);
  });

  it('a phone flip re-themes in place: no remount, typed reps stay (QA R6-01)', async () => {
    mounts = 0;
    await render(<App />);
    await fireEvent.press(screen.getByRole('button'));
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('reps 2')).toBeTruthy();

    phone.mockReturnValue('dark');
    await act(async () => useAppearanceStore.setState({ appearance: 'auto' }));
    await screen.rerender(<App />);
    expect(screen.getByText(PALETTES.dark.background)).toBeTruthy();
    expect(screen.getByTestId('probe').props.style.backgroundColor).toBe(PALETTES.dark.surface);
    expect(screen.getByText('reps 2')).toBeTruthy();
    expect(mounts).toBe(1);
  });

  it('a fixed choice wins over the phone, and switches instantly', async () => {
    phone.mockReturnValue('dark');
    useAppearanceStore.setState({ appearance: 'light' });
    await render(<App />);
    expect(screen.getByText(PALETTES.light.background)).toBeTruthy();
    expect(screen.getByTestId('probe').props.style.backgroundColor).toBe(PALETTES.light.surface);

    await act(async () => useAppearanceStore.getState().setAppearance('dark'));
    expect(screen.getByText(PALETTES.dark.background)).toBeTruthy();
    expect(screen.getByTestId('probe').props.style.backgroundColor).toBe(PALETTES.dark.surface);
  });
});
