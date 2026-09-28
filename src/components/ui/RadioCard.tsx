import { Pressable, View, type PressableProps } from 'react-native';

import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { AppText } from './AppText';

export type RadioCardProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Optional second line (mockup 09 goal descriptions). */
  description?: string;
  selected: boolean;
};

/** Single-choice row (mockup 02 "Who's training?"). */
export function RadioCard({ label, description, selected, ...rest }: RadioCardProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ checked: selected }}
      // Web reads aria-checked from here; never null (QA round 2).
      aria-checked={selected}
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
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" color={colors.muted}>
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    minHeight: sizes.primaryButtonHeight,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  text: { flex: 1, paddingVertical: spacing.sm },
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
}));
