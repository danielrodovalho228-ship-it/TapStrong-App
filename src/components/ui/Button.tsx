import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, radius, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

/**
 * primary: black, the default main button (Continue, Get started).
 * accent: orange, only for the single most important action on a screen
 *   (e.g. Generate my workout, Start with warm-up).
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'ghost'
  /** Accent outline: "I feel pain", "End workout" (mockups 11, 21). */
  | 'danger'
  /** Accent text only: "Discard workout" (mockup 13). */
  | 'dangerText'
  /** Light outline on dark screens: "+30 s" (mockup 12). */
  | 'onDark'
  /** Teal fill: the 60+ home "Start" (mockup 23). */
  | 'teal';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = true,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const filled = variant === 'primary' || variant === 'accent' || variant === 'teal';
  const textColor = filled
    ? colors.onAccent
    : variant === 'danger' || variant === 'dangerText'
      ? colors.accent
      : variant === 'onDark'
        ? colors.dark.text
        : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'primary' && { backgroundColor: pressed ? colors.mutedStrong : colors.ink },
        variant === 'accent' && {
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
        },
        variant === 'teal' && { backgroundColor: pressed ? colors.ink : colors.teal },
        variant === 'secondary' && [styles.secondary, pressed && styles.secondaryPressed],
        variant === 'ghost' && [styles.ghost, pressed && styles.ghostPressed],
        variant === 'danger' && [styles.danger, pressed && styles.ghostPressed],
        variant === 'dangerText' && [styles.ghost, pressed && styles.ghostPressed],
        variant === 'onDark' && [styles.onDark, pressed && styles.onDarkPressed],
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <AppText variant="button" color={textColor} numberOfLines={1}>
            {label}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.primaryButtonHeight,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  secondaryPressed: { backgroundColor: colors.line },
  ghost: { backgroundColor: 'transparent', minHeight: sizes.touchTarget },
  ghostPressed: { backgroundColor: colors.line },
  danger: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  onDark: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.mutedStrong },
  onDarkPressed: { borderColor: colors.dark.text },
  disabled: { opacity: 0.45 },
});
