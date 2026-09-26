import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, radius, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

/**
 * primary: black, the default main button (Continue, Get started).
 * accent: orange, only for the single most important action on a screen
 *   (e.g. Generate my workout, Start with warm-up).
 */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';

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
  const filled = variant === 'primary' || variant === 'accent';
  const textColor = filled ? colors.onAccent : colors.ink;

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
        variant === 'secondary' && [styles.secondary, pressed && styles.secondaryPressed],
        variant === 'ghost' && [styles.ghost, pressed && styles.ghostPressed],
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
  disabled: { opacity: 0.45 },
});
