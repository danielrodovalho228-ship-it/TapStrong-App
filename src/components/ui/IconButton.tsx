import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { Icon, type IconName } from './Icon';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Required: icon-only controls must have a screen-reader label. */
  accessibilityLabel: string;
  variant?: 'plain' | 'outlined' | 'filled';
  color?: string;
};

export function IconButton({ icon, variant = 'plain', color, disabled, ...rest }: IconButtonProps) {
  const iconColor = color ?? (variant === 'filled' ? colors.onAccent : colors.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'outlined' && styles.outlined,
        variant === 'filled' && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        variant !== 'filled' && pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Icon name={icon} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlined: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.line },
  disabled: { opacity: 0.45 },
});
