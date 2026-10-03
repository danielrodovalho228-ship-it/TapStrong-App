/**
 * Phase 31, package A: dark by default (Light stays in Settings), five tabs
 * — Workout, Exercises, Library, Progress, Settings — and family profiles
 * opening from Settings.
 */
import i18n from '@/i18n';

import { readFileSync } from 'fs';
import { join } from 'path';

import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { resolveScheme, useAppearanceStore } from '@/features/appearance/store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
}));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

describe('theme', () => {
  it('dark is the default; the old default "auto" moves to dark, a fixed choice stays', async () => {
    expect(useAppearanceStore.getInitialState().appearance).toBe('dark');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    const migrate = useAppearanceStore.persist.getOptions().migrate!;
    expect(await migrate({ appearance: 'auto' }, 1)).toEqual({ appearance: 'dark' });
    expect(await migrate({ appearance: 'light' }, 1)).toEqual({ appearance: 'light' });
  });
});

describe('tabs', () => {
  const layout = readFileSync(join(__dirname, '../../app/(tabs)/_layout.tsx'), 'utf8');
  const visible = [
    ...layout.matchAll(/<Tabs\.Screen\s+name="([a-z]+)"\s+options=\{\{\s*(href: null)?/g),
  ]
    .filter((m) => !m[2])
    .map((m) => m[1]);

  it('five tabs in order: Workout, Exercises, Library, Progress, Settings', () => {
    expect(visible).toEqual(['home', 'body', 'library', 'progress', 'settings']);
    expect(layout).toMatch(/name="family" options=\{\{ href: null/);
  });

  it.each(['en', 'es', 'pt-BR'])('%s: every tab has a label', (lng) => {
    const t = i18n.getFixedT(lng) as unknown as (key: string) => string;
    for (const key of ['home', 'body', 'library', 'progress', 'settings'])
      expect(t(`tabs.${key}`)).not.toMatch(/^tabs\./);
    expect(i18n.getFixedT('pt-BR')('tabs.home')).toBe('Treino');
  });
});

describe('Settings as a tab', () => {
  it('has no back button and opens the family profiles', async () => {
    await render(<SettingsScreen />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Family' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/family');
  });
});
