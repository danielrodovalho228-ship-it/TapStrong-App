import { Stack } from 'expo-router';

import { useColors } from '@/theme';

/** Workout flow — SPEC §9: list → play ⇄ rest, with pain and exit over the player. */
export default function WorkoutLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="play" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="rest"
        options={{
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: colors.dark.background },
        }}
      />
      <Stack.Screen
        name="pain"
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="exit" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="done" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
