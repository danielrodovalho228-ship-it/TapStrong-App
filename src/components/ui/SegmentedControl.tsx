import { Pressable, View } from 'react-native';

import { colors, makeStyles, radius, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Screen-reader name when several controls share option labels (QA round 1). */
  accessibilityLabel?: string;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** Mockup 01 language switch. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
            // Web reads aria-checked, not accessibilityState (QA R3: it was null).
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <AppText
              variant="label"
              color={selected ? colors.onInk : colors.mutedStrong}
              style={styles.text}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: sizes.touchTarget,
    borderRadius: radius.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selected: { backgroundColor: colors.ink },
  text: { textAlign: 'center' },
}));
