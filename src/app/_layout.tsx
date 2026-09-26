import '@/i18n';

import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { refreshBilling } from '@/features/billing/actions';
import { useNotificationSync } from '@/features/notifications/useNotificationSync';
import { useSyncProfileSettings } from '@/features/onboarding/sync';
import { startMonitoring } from '@/lib/monitoring';
import { colors } from '@/theme';

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

  // Latest subscription state from the store (best effort, offline is fine).
  useEffect(() => {
    void refreshBilling();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
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
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
