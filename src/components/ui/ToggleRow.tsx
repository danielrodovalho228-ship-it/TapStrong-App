import { StyleSheet, Switch, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

export type ToggleRowProps = {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** Setting row with a switch (mockup 16). */
export function ToggleRow({ label, detail, value, onChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {detail ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        aria-checked={value}
        // A 44 px target around the switch (QA R4 P2).
        style={styles.switch}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.ink }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.md,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xxs },
  switch: { minWidth: sizes.touchTarget, minHeight: sizes.touchTarget },
});
