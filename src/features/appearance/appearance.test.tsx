/**
 * Theme v2 — Settings → Appearance and the live switch: Automatic follows
 * the phone, Light / Dark are fixed, and the change is instant.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme, View } from 'react-native';

import AppearanceScreen from '@/app/settings/appearance';
import { AppText } from '@/components/ui';
import { applyScheme, colors, makeStyles, PALETTES } from '@/theme';

import { useAppearanceStore } from './store';
import { ThemedScreen, ThemeGate } from './ThemeGate';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const phone = useColorScheme as jest.Mock;

const styles = makeStyles(() => ({ probe: { backgroundColor: colors.surface } }));
function Probe() {
  return (
    <View testID="probe" style={styles.probe}>
      <AppText>{colors.background}</AppText>
    </View>
  );
}

function App() {
  return (
    <ThemeGate>
      <ThemedScreen>
        <Probe />
      </ThemedScreen>
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
