import { Stack } from 'expo-router';

import { useColors } from '@/theme';

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
