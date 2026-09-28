import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

export type AreaChipProps = {
  muscle: string;
  goal: string;
  onPress: () => void;
  onRemove: () => void;
  removeLabel: string;
  pressLabel: string;
  /** Localized " · " between muscle and goal. */
  separator: string;
};

/** Dark "UPPER CHEST · GROW ×" chip under the body map (mockup 08). */
export function AreaChip({
  muscle,
  goal,
  onPress,
  onRemove,
  removeLabel,
  pressLabel,
  separator,
}: AreaChipProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.chip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pressLabel}
        onPress={onPress}
        style={styles.main}
      >
        <AppText variant="button" color={colors.dark.text}>
          {muscle}
          {separator}
          <AppText variant="button" color={colors.dark.accentSoft}>
            {goal}
          </AppText>
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        onPress={onRemove}
        style={styles.remove}
      >
        <Icon name="close" size={16} color={colors.dark.text} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    // Always dark, like the hero cards, so the coral goal reads in both modes.
    backgroundColor: colors.dark.background,
    borderRadius: radius.chip,
    minHeight: sizes.touchTarget + 4,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  main: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  remove: {
    // Full 44 px target (QA round 1).
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    margin: 2,
    borderRadius: radius.chip,
    backgroundColor: colors.dark.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
