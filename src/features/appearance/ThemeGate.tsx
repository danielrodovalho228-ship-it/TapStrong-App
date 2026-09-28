import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme, View } from 'react-native';

import { applyScheme, colors, makeStyles, type Scheme } from '@/theme';

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

const SchemeContext = createContext<Scheme>('light');

/** The scheme on screen (set by ThemeGate). */
export const useScheme = () => useContext(SchemeContext);

/**
 * Applies the active palette before anything below renders. Status bar, the
 * Android system background (edge-to-edge navigation bar) and the root view
 * follow it. The navigator itself stays mounted, so a change keeps the
 * navigation history; screens remount through ThemedScreen.
 *
 * Web pages are pre-rendered in Light, and hydration keeps the server's
 * styles, so on web the first render matches that HTML and the real scheme
 * follows right after mount.
 */
export function ThemeGate({ children }: { children: ReactNode }) {
  const wanted = useWantedScheme();
  const hydrated = useSyncExternalStore(noop, isClient, isServer);
  const scheme: Scheme = hydrated ? wanted : 'light';
  applyScheme(scheme);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [scheme]);

  return (
    <SchemeContext.Provider value={scheme}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </View>
    </SchemeContext.Provider>
  );
}

/**
 * Stack screen layout: remounts a screen's content when the scheme changes,
 * so every style and color is read again from the new palette (instant, no
 * restart).
 */
export function ThemedScreen({ children }: { children: ReactNode }) {
  const scheme = useScheme();
  return <Fragment key={scheme}>{children}</Fragment>;
}

const styles = makeStyles(() => ({
  root: { flex: 1 },
}));
