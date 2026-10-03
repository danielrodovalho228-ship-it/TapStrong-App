import '@/i18n';

import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeGate } from '@/features/appearance/ThemeGate';
import { refreshBilling } from '@/features/billing/actions';
import { refreshReleasedLibrary } from '@/features/exercises/released';
import { CaptchaHost } from '@/features/captcha/CaptchaHost';
import { WebFamilyGate } from '@/features/family/components/WebMobileOnly';
import { useNotificationSync } from '@/features/notifications/useNotificationSync';
import { useSyncProfileSettings } from '@/features/onboarding/sync';
import { ScreenshotOfferBar } from '@/features/share/ScreenshotOfferBar';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { startMonitoring } from '@/lib/monitoring';
import { watchAppOpens } from '@/lib/usage';
import { useColors, useScheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
startMonitoring();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const ready = fontsLoaded || !!fontError;
  useSyncProfileSettings();
  useNotificationSync();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Yesterday's planned or unfinished workouts never come back (QA R5-03):
  // on launch and whenever the app returns to the foreground.
  useEffect(() => {
    const close = () => useWorkoutStore.getState().closeStale(localDate(clock.now()));
    close();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') close();
    });
    return () => sub.remove();
  }, []);

  // Anonymous usage marks (Phase 27 "Measure"): app opens, day 7 / day 30.
  useEffect(() => watchAppOpens(), []);

  // Latest subscription state from the store (best effort, offline is fine).
  useEffect(() => {
    void refreshBilling();
  }, []);

  // The released exercise library, kept on the phone (best effort, offline is fine).
  useEffect(() => {
    void refreshReleasedLibrary();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeGate>
            {/* Web = adults without family, on every address (round 2, S2-P2-1). */}
            <WebFamilyGate>
              <AppStack />
            </WebFamilyGate>
            {/* "Want a nicer version to post?" after a screenshot (Phase 28, C). */}
            <ScreenshotOfferBar />
            {/* Turnstile check for anonymous sign-in and email codes (S2-04). */}
            <CaptchaHost />
          </ThemeGate>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Rendered inside ThemeGate, so its colors come from the active palette. */
function AppStack() {
  const colors = useColors();
  const scheme = useScheme();
  // The navigator's own colors come from our tokens too, so no default grey
  // shows during native transitions in Dark (QA R7 P2).
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accentText,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      notification: colors.accent,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Goals opens as a sheet over the body map (mockup 09). */}
        <Stack.Screen
          name="goals"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.92],
          }}
        />
        <Stack.Screen
          name="share"
          options={{ contentStyle: { backgroundColor: colors.dark.background } }}
        />
        <Stack.Screen
          name="milestone"
          options={{
            animation: 'fade',
            contentStyle: { backgroundColor: colors.dark.background },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

// The "component with the name 'o'" warning (QA R5/R6 P2) comes from Expo
// Router's own minified wrapper in development web builds; release bundles
// don't contain it (bundle:check proves it).
