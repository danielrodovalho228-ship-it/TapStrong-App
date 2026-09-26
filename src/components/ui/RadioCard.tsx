import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, radius, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

export type RadioCardProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected: boolean;
};

/** Single-choice row (mockup 02 "Who's training?"). */
export function RadioCard({ label, selected, ...rest }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
      {...rest}
    >
      <View style={[styles.dot, selected && styles.dotSelected]}>
        {selected ? <View style={styles.dotInner} /> : null}
      </View>
      <AppText variant="bodyStrong">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: sizes.primaryButtonHeight,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  idle: { borderWidth: 1, borderColor: colors.line },
  selected: { borderWidth: 2, borderColor: colors.ink },
  pressed: { borderColor: colors.ink },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: { borderColor: colors.ink, backgroundColor: colors.ink },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
});
