import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { AppText, Card, Header, Screen } from '@/components/ui';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { createWorkoutFrom, useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { fullWorkoutAllowed } from '@/features/workout/secondWorkout';
import { useWorkoutStore } from '@/features/workout/store';
import { useTodayState } from '@/features/workout/useTodayState';
import { spacing, useColors } from '@/theme';

/**
 * Workout modes (improvements v1, A6; mockup 09 choice cards): My plan,
 * Single workout, Custom, and the ready-made plans.
 */
export default function NewWorkoutScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const workouts = useWorkoutStore((s) => s.workouts);
  const mode = modeOf(useOnboardingStore());

  const today = useTodayState();
  const myPlan = () => {
    // After today's workout (60+ and teens) or a sharp stop: back to Home's
    // mobility, balance or rest (QA R8 P2).
    if (!fullWorkoutAllowed(today)) return router.replace('/home');
    const existing = workouts.find((w) => w.status === 'planned' && w.kind === 'regular');
    const id = existing?.id ?? createWorkoutFrom(input, library);
    router.replace({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };

  const options: { key: string; title: string; body: string; onPress: () => void }[] = [
    { key: 'myPlan', title: t('modes.myPlan'), body: t('modes.myPlanBody'), onPress: myPlan },
    {
      key: 'single',
      title: t('modes.single'),
      body: t('modes.singleBody'),
      onPress: () => router.push('/workout/single'),
    },
    // Custom lists are for teens and adults; 60+ keeps the simpler choices.
    ...(mode !== 'senior'
      ? [
          {
            key: 'custom',
            title: t('modes.custom'),
            body: t('modes.customBody'),
            onPress: () => router.push('/workout/custom'),
          },
        ]
      : []),
    {
      key: 'plans',
      title: t('modes.plans'),
      body: t('modes.plansBody'),
      onPress: () => router.push('/programs'),
    },
  ];

  return (
    <Screen header={<Header onBack={() => router.back()} title={t('modes.title')} />}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          accessibilityRole="button"
          accessibilityLabel={`${o.title}, ${o.body}`}
          onPress={o.onPress}
        >
          <Card style={styles.card}>
            <AppText variant="h3">{o.title}</AppText>
            <AppText color={colors.mutedStrong}>{o.body}</AppText>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.xs } });
