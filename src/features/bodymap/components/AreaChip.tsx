import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { colors, radius, sizes, spacing } from '@/theme';

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
  return (
    <View style={styles.chip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pressLabel}
        onPress={onPress}
        style={styles.main}
      >
        <AppText variant="button" color={colors.onAccent}>
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
        <Icon name="close" size={16} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.chip,
    minHeight: sizes.touchTarget,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  main: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  remove: {
    width: sizes.touchTarget - 4,
    height: sizes.touchTarget - 4,
    margin: 2,
    borderRadius: radius.chip,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
