import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { mainSetCounts } from '@/features/workout/flow';
import { endWorkout, useWorkout } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

/** Mockup 13 — "End workout?": keep going / save & end / discard. */
export default function ExitScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout } = useWorkout(id);
  const discard = useWorkoutStore((s) => s.discard);
  if (!workout) return <Redirect href="/home" />;

  const { done, total } = mainSetCounts(workout);
  const anything = workout.logs.length > 0;

  const saveAndEnd = () => {
    endWorkout(workout.id, 'partial');
    router.replace({ pathname: '/workout/[id]/done', params: { id: workout.id } });
  };

  const discardAll = () => {
    discard(workout.id);
    router.dismissAll();
    router.replace('/home');
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.card} accessibilityViewIsModal>
        <AppText variant="h1" accessibilityRole="header">
          {t('workout.exit.title')}
        </AppText>
        <AppText color={colors.mutedStrong}>
          {anything ? t('workout.exit.body', { done, total }) : t('workout.exit.bodyEmpty')}
        </AppText>
        <Button label={t('workout.exit.keepGoing')} onPress={() => router.back()} />
        {anything ? (
          <Button variant="secondary" label={t('workout.exit.saveEnd')} onPress={saveAndEnd} />
        ) : null}
        <Button variant="dangerText" label={t('workout.exit.discard')} onPress={discardAll} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, opacity: 0.6 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.card * 2,
    padding: spacing.xl,
    gap: spacing.md,
  },
}));
