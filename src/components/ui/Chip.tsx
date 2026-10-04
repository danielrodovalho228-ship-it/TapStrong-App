import { Platform, Pressable, type PressableProps } from 'react-native';

import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { noteTap } from '@/lib/usage';

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
      // Taps to the first set (Phase 27 "Measure"): a count, nothing else.
      onPressIn={(e) => {
        noteTap();
        rest.onPressIn?.(e);
      }}
    >
      {/* A check, not only a tint: in the dark theme a tint alone read as "pre-selected" (Phase 32). */}
      {selected ? <Icon name="check" size={16} color={colors.teal} /> : null}
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
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.line },
  // Theme v2: selected chips are a soft tint with a check and a teal edge;
  // coral stays for actions, the active tab, today and progress (QA R6 P2).
  selected: { backgroundColor: colors.tealTint, borderColor: colors.teal, borderWidth: 2 },
  pressed: { borderColor: colors.ink },
  disabled: { opacity: 0.45 },
}));
