import { Platform, Pressable, type PressableProps } from 'react-native';

import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { AppText } from './AppText';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
};

export function Chip({ label, selected = false, disabled, ...rest }: ChipProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      // Web reads a toggle button's state from aria-pressed (QA R4 P2).
      {...(Platform.OS === 'web' ? ({ 'aria-pressed': selected } as Record<string, boolean>) : {})}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <AppText variant="label" color={colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.line },
  // Theme v2: selected chips are a soft tint with an ink edge; coral stays for
  // actions, the active tab, today and progress (QA R6 P2).
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.ink },
  pressed: { borderColor: colors.ink },
  disabled: { opacity: 0.45 },
}));
