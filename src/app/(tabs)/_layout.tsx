import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** Main area. Becomes a tab bar (home, body, coach, progress, family) in Phase 4. */
export default function MainLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
