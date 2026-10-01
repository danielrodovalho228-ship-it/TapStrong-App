import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import type { GeneratedSession, SessionItem } from '@/features/generator/types';
import { ExerciseThumb } from '@/features/workout/components/Media';
import { doseText, exerciseName } from '@/features/workout/format';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/** "3 sets × 8–12" for reps; holds and timed moves keep their own dose text. */
export function setsText(t: TFunction, item: SessionItem): string {
  if (!item.reps) return doseText(t, item);
  const [a, b] = item.reps;
  return t('home.preview.sets', {
    count: item.sets,
    reps: a === b ? `${a}` : `${a}–${b}`,
  });
}

/**
 * Today's workout on Home (Phase 29, B1; like Gymverse): the summary on top,
 * then each main exercise with its poster (profile's sex), "3 sets × 8–12"
 * and a swap icon that opens the workout, where the swap sheet lives.
 */
export function WorkoutPreview({
  session,
  byId,
  summary,
  onSwap,
}: {
  session: GeneratedSession;
  byId: Map<string, Exercise>;
  summary: string | null;
  onSwap: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const mains = session.items.filter((i) => i.role === 'main');
  if (!mains.length) return null;
  return (
    <View style={styles.wrap} testID="home-preview">
      {summary ? (
        <AppText variant="label" color={colors.mutedStrong}>
          {summary}
        </AppText>
      ) : null}
      {mains.map((item) => {
        const e = byId.get(item.exerciseId);
        const name = exerciseName(t, e, item.exerciseId);
        return (
          <View key={item.id} style={styles.row} testID="home-preview-item">
            <ExerciseThumb size={52} slug={e?.slug} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {name}
              </AppText>
              <AppText variant="caption" color={colors.mutedStrong}>
                {setsText(t, item)}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.swap.open', { name })}
              onPress={onSwap}
              hitSlop={4}
              style={styles.swap}
            >
              <Icon name="swap" size={20} color={colors.mutedStrong} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60 },
  text: { flex: 1, gap: spacing.xxs },
  swap: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
