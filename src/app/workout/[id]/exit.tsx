import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { mainSetCounts } from '@/features/workout/flow';
import { endWorkout, useWorkout } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

/**
 * The workout menu, opened from "⋯" in the player (Phase 29, B7; mockup 13):
 * pause (back to Home, the workout stays open), finish (save what is logged),
 * discard (asks first). Tapping outside goes back to the workout.
 */
export default function ExitScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout } = useWorkout(id);
  const discard = useWorkoutStore((s) => s.discard);
  const [confirm, setConfirm] = useState(false);
  if (!workout) return <Redirect href="/home" />;

  const { done, total } = mainSetCounts(workout);
  const anything = workout.logs.length > 0;

  const saveAndEnd = () => {
    endWorkout(workout.id, 'partial');
    router.replace({ pathname: '/workout/[id]/done', params: { id: workout.id } });
  };

  const pause = () => {
    router.dismissAll();
    router.replace('/home');
  };

  const discardAll = () => {
    discard(workout.id);
    router.dismissAll();
    router.replace('/home');
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t('workout.exit.keepGoing')}
        onPress={() => router.back()}
      />
      {confirm ? (
        <View style={styles.card} accessibilityViewIsModal testID="discard-confirm">
          <AppText variant="h2" accessibilityRole="header">
            {t('workout.exit.discardTitle')}
          </AppText>
          <AppText color={colors.mutedStrong}>{t('workout.exit.discardBody')}</AppText>
          <Button variant="danger" label={t('workout.exit.discardYes')} onPress={discardAll} />
          <Button
            variant="ghost"
            label={t('workout.exit.discardNo')}
            onPress={() => setConfirm(false)}
          />
        </View>
      ) : (
        <View style={styles.card} accessibilityViewIsModal>
          <AppText variant="h2" accessibilityRole="header">
            {t('workout.exit.title')}
          </AppText>
          <AppText color={colors.mutedStrong}>
            {anything ? t('workout.exit.body', { done, total }) : t('workout.exit.bodyEmpty')}
          </AppText>
          <Button variant="secondary" label={t('workout.exit.pause')} onPress={pause} />
          {anything ? <Button label={t('workout.exit.saveEnd')} onPress={saveAndEnd} /> : null}
          <Button
            variant="dangerText"
            label={t('workout.exit.discard')}
            onPress={() => setConfirm(true)}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.card * 2,
    padding: spacing.xl,
    gap: spacing.md,
  },
}));
