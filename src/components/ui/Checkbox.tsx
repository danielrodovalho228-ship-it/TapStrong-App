import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Icon name="check" size={18} color={colors.onAccent} strokeWidth={2.5} /> : null}
      </View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.mutedStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { flex: 1 },
});
