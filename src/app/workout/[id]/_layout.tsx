import { Stack } from 'expo-router';

import { useColors } from '@/theme';

/**
 * Workout flow — SPEC §9: list → play ⇄ rest, with pain and exit over the
 * player. Player screens change with a 250 ms fade (Phase 27, B2).
 */
const PLAYER_TRANSITION = { animation: 'fade', animationDuration: 250 } as const;

export default function WorkoutLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="play" options={{ ...PLAYER_TRANSITION, gestureEnabled: false }} />
      <Stack.Screen
        name="rest"
        options={{
          ...PLAYER_TRANSITION,
          gestureEnabled: false,
          contentStyle: { backgroundColor: colors.dark.background },
        }}
      />
      <Stack.Screen
        name="pain"
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="exit"
        options={{ presentation: 'transparentModal', ...PLAYER_TRANSITION }}
      />
      <Stack.Screen name="done" options={{ ...PLAYER_TRANSITION, gestureEnabled: false }} />
    </Stack>
  );
}
