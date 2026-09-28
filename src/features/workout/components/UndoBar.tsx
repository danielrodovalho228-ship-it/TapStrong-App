import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { UNDO_MS, useWorkoutStore } from '../store';

/** "Swapped to … · Undo", visible for 5 seconds after a swap (SPEC §8). */
export function UndoBar({ message, onDone }: { message: string | null; onDone: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const undoSwap = useWorkoutStore((s) => s.undoSwap);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, UNDO_MS);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <AppText color={colors.onSurfaceRaised} style={styles.text}>
        {message}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.swap.undo')}
        onPress={() => {
          undoSwap();
          onDone();
        }}
        style={styles.undo}
      >
        <AppText variant="button" color={colors.accentOnRaised}>
          {t('workout.swap.undo')}
        </AppText>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.button,
    paddingLeft: spacing.lg,
  },
  text: { flex: 1 },
  undo: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
}));
