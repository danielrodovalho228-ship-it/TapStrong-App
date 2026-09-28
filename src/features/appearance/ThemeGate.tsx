import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { applyScheme, PALETTES, SchemeContext, type Scheme } from '@/theme';

import { resolveScheme, useAppearanceStore } from './store';

/** The scheme the choice asks for: the Appearance setting, or the phone's. */
function useWantedScheme(): Scheme {
  const appearance = useAppearanceStore((s) => s.appearance);
  return resolveScheme(appearance, useColorScheme());
}

const noop = () => () => undefined;
const isClient = () => true;
// While hydrating a web page, React reads this snapshot, then re-renders.
const isServer = () => Platform.OS !== 'web';

/**
 * Provides the scheme on screen. Components read it through `useColors()`
 * and the hooks `makeStyles` returns, so a change re-renders them in place:
 * nothing remounts, and the route, its params and screen state (a running
 * workout's reps and timer) stay (QA R6-01). Status bar, the Android system
 * background (edge-to-edge navigation bar) and the root view follow it.
 *
 * Web pages are pre-rendered in Light, and hydration keeps the server's
 * styles, so on web the first render matches that HTML and the real scheme
 * follows right after mount.
 */
export function ThemeGate({ children }: { children: ReactNode }) {
  const wanted = useWantedScheme();
  const hydrated = useSyncExternalStore(noop, isClient, isServer);
  const scheme: Scheme = hydrated ? wanted : 'light';
  // Code outside React (and style factories) reads the same palette.
  applyScheme(scheme);
  const background = PALETTES[scheme].background;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background).catch(() => undefined);
  }, [background]);

  // Web: the page was hidden in Dark until now (+html.tsx); show it once the
  // real scheme is on screen.
  useEffect(() => {
    if (Platform.OS === 'web' && hydrated && typeof document !== 'undefined')
      document.documentElement.dataset.ready = '1';
  }, [hydrated, scheme]);

  return (
    <SchemeContext.Provider value={scheme}>
      <View style={[styles.root, { backgroundColor: background }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </View>
    </SchemeContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
